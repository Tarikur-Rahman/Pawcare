namespace PawCare.Api.Modules.Auth;
public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record LoginRequest(string Email, string Password, string? DeviceLabel);
public sealed record RefreshRequest(string RefreshToken);
public sealed record LogoutRequest(string RefreshToken);
public sealed record VerifyEmailRequest(string Token);
public sealed record ResendVerificationRequest(string Email);
public sealed record LoginResult(string AccessToken, DateTimeOffset ExpiresAtUtc,
    string RefreshToken, string TokenType = "Bearer");
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Token, string NewPassword);
