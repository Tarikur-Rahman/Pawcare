using System.Security.Claims;
using System.Security.Cryptography;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
using PawCare.Api.Infrastructure.Email;
namespace PawCare.Api.Modules.Auth;
public sealed class AuthService(AuthRepository repository, IPawCarePasswordHasher hasher,
    IJwtTokenService tokens, TimeProvider clock, IEmailGateway email, IConfiguration configuration, IPasswordResetDispatcher passwordResetDispatch, ILogger<AuthService> logger)
{
    public async Task<object> Register(RegisterRequest request,CancellationToken ct)
    {
        var email=AuthValidation.Email(request.Email);
        AuthValidation.Password(request.Password);
        var name=ModuleRules.Text(request.DisplayName,120,"displayName");
        if (await repository.Account(email,ct) is not null)
            throw new DomainException(DomainErrors.Conflict("EMAIL_IN_USE","This email is already registered."));
        long id;
        try { id=await repository.Register(email,hasher.HashPassword(request.Password),name,ct); }
        catch(OracleException error) when (error.Number == 1)
        {
            // Unique-email collision from concurrent registrations.
            throw new DomainException(DomainErrors.Conflict("EMAIL_IN_USE", "This email is already registered."));
        }
        await SendVerification(id, email, ct);
        return new { id, status="PENDING_VERIFICATION", message="Account created; verification required before sign-in." };
    }

    public async Task VerifyEmail(VerifyEmailRequest request, CancellationToken ct)
    {
        ModuleRules.Check(!string.IsNullOrWhiteSpace(request.Token) && request.Token.Length is >= 40 and <= 128, "token");
        ModuleRules.Conflict(await repository.VerifyToken(ModuleRules.Hash(request.Token), ct),
            "The verification link is invalid or expired.");
    }

    public async Task ResendVerification(ResendVerificationRequest request, CancellationToken ct)
    {
        var emailAddress = AuthValidation.Email(request.Email);
        var account = await repository.Account(emailAddress, ct);
        if (account is null || ModuleRules.Str(account, "STATUS") != "PENDING_VERIFICATION") return;
        await SendVerification(ModuleRules.Id(account, "USER_ID"), emailAddress, ct);
    }
    // Always use the same public response, including for unknown, disabled or rate-limited accounts.
    public async Task ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
    {
        var address = AuthValidation.Email(request.Email);
        var account = await repository.Account(address, ct);
        if (account is null || ModuleRules.Str(account, "STATUS") != "ACTIVE") return;

        var token = VerificationTokenGenerator.Generate();
        var origin = configuration["Email:VerificationUrlBase"];
        string link;
        try { link = PasswordResetPolicy.BuildLink(origin, token); }
        catch (ArgumentException)
        {
            logger.LogWarning("Password recovery URL configuration is invalid.");
            return;
        }
        var created = await repository.IssuePasswordResetToken(
            ModuleRules.Id(account, "USER_ID"), ModuleRules.Hash(token),
            clock.GetUtcNow().Add(PasswordResetPolicy.Lifetime), ct);
        if (!created) return;

        var message = new EmailMessage(address, "Reset your PawCare password",
            $"A password reset was requested for your PawCare account.\n" +
            $"Open this link to set a new password:\n{link}\n" +
            "This link expires in 30 minutes and can be used only once.\n" +
            "If you did not request it, you can ignore this email.");
        if (!passwordResetDispatch.TryQueue(message))
            logger.LogWarning("Password recovery delivery queue is full; request response remains generic.");
    }

    public async Task ResetPassword(ResetPasswordRequest request, CancellationToken ct)
    {
        ModuleRules.Check(PasswordResetPolicy.IsValidToken(request.Token), "token", "Invalid password reset link.");
        AuthValidation.Password(request.NewPassword);
        var encodedPassword = hasher.HashPassword(request.NewPassword);
        if (!await repository.ConsumePasswordResetToken(
            ModuleRules.Hash(request.Token), encodedPassword, ct))
            throw new DomainException(new DomainError("INVALID_RESET_TOKEN",
                "This password reset link is invalid, expired, or already used.", 400));
    }

    public async Task<LoginResult> Login(LoginRequest request,CancellationToken ct)
    {
        var email=AuthValidation.Email(request.Email);
        var row=await repository.Account(email,ct);
        if(row is null || hasher.VerifyPassword(ModuleRules.Str(row,"PASSWORD_HASH"),request.Password)
            ==PasswordVerificationOutcome.Failed || ModuleRules.Str(row,"STATUS")!="ACTIVE")
            throw new DomainException(new DomainError("INVALID_CREDENTIALS","Incorrect credentials or unavailable account.",401));
        var id=ModuleRules.Id(row,"USER_ID");
        var result=tokens.IssueAccessToken(id,ModuleRules.Str(row,"ROLE"),"ACTIVE");
        var refresh=GenerateRefresh();
        await repository.SaveSession(id,ModuleRules.Hash(refresh),ModuleRules.Text(request.DeviceLabel ?? "PawCare",140,"deviceLabel"),
            clock.GetUtcNow().AddDays(14),ct);
        return new LoginResult(result.AccessToken,result.ExpiresAtUtc,refresh);
    }
    public async Task<LoginResult> Refresh(RefreshRequest request,CancellationToken ct)
    {
        ModuleRules.Check(!string.IsNullOrWhiteSpace(request.RefreshToken) && request.RefreshToken.Length is >= 30 and <= 256,"refreshToken");
        var refresh=GenerateRefresh();
        var row=await repository.RotateSession(ModuleRules.Hash(request.RefreshToken),ModuleRules.Hash(refresh),
            clock.GetUtcNow().AddDays(14),ct);
        var token=tokens.IssueAccessToken(ModuleRules.Id(row,"userId"),ModuleRules.Str(row,"ROLE"),ModuleRules.Str(row,"STATUS"));
        return new LoginResult(token.AccessToken,token.ExpiresAtUtc,refresh);
    }
    public async Task<object?> Me(ClaimsPrincipal principal,CancellationToken ct)
    {
        var id = ModuleRules.UserId(principal);
        var profile = await repository.Self(id, ct);
        if (profile is null) return null;
        profile["capabilities"] = await repository.Capabilities(id, ct);
        return profile;
    }
    // Refresh token is never emitted in logs and only its SHA-256 hash is persisted.
    public Task<int> Logout(ClaimsPrincipal principal,LogoutRequest request,CancellationToken ct)
    {
        ModuleRules.Check(!string.IsNullOrWhiteSpace(request.RefreshToken) && request.RefreshToken.Length is >=30 and <=256,
            "refreshToken");
        return repository.Logout(ModuleRules.UserId(principal),ModuleRules.Hash(request.RefreshToken),ct);
    }
    private static string GenerateRefresh() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
        .TrimEnd('=').Replace('+','-').Replace('/','_');

    private async Task SendVerification(long userId, string address, CancellationToken ct)
    {
        var token = VerificationTokenGenerator.Generate();
        var expires = clock.GetUtcNow().AddHours(24);
        if (!await repository.IssueVerificationToken(userId, ModuleRules.Hash(token), expires, ct))
            throw new DomainException(DomainErrors.RateLimited());
        var baseUrl = configuration["Email:VerificationUrlBase"];
        if (string.IsNullOrWhiteSpace(baseUrl) || !Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("https" or "http"))
            throw new DomainException(DomainErrors.ServiceUnavailable());
        var link = $"{baseUrl.TrimEnd('/')}/api/v1/auth/verify-email?token={Uri.EscapeDataString(token)}";
        await email.SendAsync(new EmailMessage(address, "Verify your PawCare email",
            $"Verify your PawCare email by opening this link:\n{link}\nThis link expires in 24 hours."),
            ct);
    }
}
