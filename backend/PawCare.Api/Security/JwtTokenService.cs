using System.Globalization;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PawCare.Api.Configuration;

namespace PawCare.Api.Security;

/// <summary>Public login response data: never includes signing keys or refresh credentials.</summary>
public sealed record IssuedAccessToken(string AccessToken, DateTimeOffset ExpiresAtUtc, string TokenType = "Bearer");

public interface IJwtTokenService
{
    IssuedAccessToken IssueAccessToken(long userId, string primaryRole, string accountStatus);
}

/// <summary>
/// Issues short-lived HS256 access tokens compatible with Program.cs's bearer validation:
/// issuer/audience, claims 'sub' and 'role', HMAC-SHA256, 30-second clock skew.
/// Load role and status from Oracle USERS, never from client-supplied fields.
/// This class does not issue/rotate/revoke refresh credentials.
/// </summary>
public sealed class JwtTokenService : IJwtTokenService
{
    public const int AccessTokenMinutes = 15;

    private readonly IOptionsMonitor<PawCareJwtOptions> _options;
    private readonly TimeProvider _clock;

    public JwtTokenService(IOptionsMonitor<PawCareJwtOptions> options, TimeProvider clock)
    {
        _options = options;
        _clock = clock;
    }

    public IssuedAccessToken IssueAccessToken(long userId, string primaryRole, string accountStatus)
    {
        if (userId <= 0) throw new ArgumentOutOfRangeException(nameof(userId));
        if (accountStatus != "ACTIVE")
        {
            throw new InvalidOperationException("A non-active account cannot receive an access token.");
        }
        if (primaryRole is not ("OWNER" or "VET" or "ADMIN"))
        {
            throw new ArgumentException("Invalid account role.", nameof(primaryRole));
        }

        var jwt = _options.CurrentValue;
        if (string.IsNullOrWhiteSpace(jwt.Issuer) || string.IsNullOrWhiteSpace(jwt.Audience) ||
            string.IsNullOrWhiteSpace(jwt.SigningKey) ||
            jwt.SigningKey.StartsWith("REPLACE_", StringComparison.OrdinalIgnoreCase) ||
            Encoding.UTF8.GetByteCount(jwt.SigningKey) < 32)
        {
            throw new InvalidOperationException("JWT configuration is missing or unsafe.");
        }

        var now = _clock.GetUtcNow();
        var expires = now.AddMinutes(AccessTokenMinutes);
        var claims = new ClaimsIdentity(new[]
        {
            new Claim("sub", userId.ToString(CultureInfo.InvariantCulture)),
            new Claim("role", primaryRole),
            new Claim("jti", Guid.NewGuid().ToString("N"))
        });

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = jwt.Audience,
            Subject = claims,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                SecurityAlgorithms.HmacSha256)
        };

        var token = new JsonWebTokenHandler().CreateToken(descriptor);
        return new IssuedAccessToken(token, expires);
    }
}
