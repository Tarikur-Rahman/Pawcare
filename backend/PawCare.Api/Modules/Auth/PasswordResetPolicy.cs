namespace PawCare.Api.Modules.Auth;

/// <summary>Opaque, single-use recovery links. The fragment is not sent in HTTP requests.</summary>
public static class PasswordResetPolicy
{
    public const int TokenLength = 64; // 48 random bytes in unpadded base64url.
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    public static bool IsValidToken(string? token) =>
        token is { Length: TokenLength } &&
        token.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    public static string BuildLink(string? publicOrigin, string token)
    {
        if (!IsValidToken(token))
            throw new ArgumentException("Invalid reset token format.", nameof(token));
        if (string.IsNullOrWhiteSpace(publicOrigin) ||
            !Uri.TryCreate(publicOrigin, UriKind.Absolute, out var uri) ||
            uri.Host.Length == 0 ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            uri.AbsolutePath != "/" ||
            (uri.Scheme != Uri.UriSchemeHttps &&
             !(uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback)))
        {
            throw new ArgumentException("Configure Email:VerificationUrlBase as a secure frontend origin.", nameof(publicOrigin));
        }
        return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/') +
            "/reset-password#token=" + Uri.EscapeDataString(token);
    }
}
