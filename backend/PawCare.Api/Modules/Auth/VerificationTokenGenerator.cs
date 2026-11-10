using System.Security.Cryptography;

namespace PawCare.Api.Modules.Auth;

public static class VerificationTokenGenerator
{
    public static string Generate()
    {
        var bytes = new byte[48];
        using var random = RandomNumberGenerator.Create();
        random.GetBytes(bytes);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
