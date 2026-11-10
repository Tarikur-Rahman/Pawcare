using System.Globalization;
using System.Security.Cryptography;

namespace PawCare.Api.Security;

/// <summary>Verification status; a successful legacy hash can be upgraded on login.</summary>
public enum PasswordVerificationOutcome
{
    Failed,
    Success,
    SuccessRehashNeeded
}

public interface IPawCarePasswordHasher
{
    string HashPassword(string password);
    PasswordVerificationOutcome VerifyPassword(string? encodedHash, string? suppliedPassword);
}

/// <summary>
/// Versioned PBKDF2-HMAC-SHA256 hashes with a fresh cryptographic 128-bit salt.
/// Format: pbkdf2-sha256$iterations$salt-base64$hash-base64.
/// Matches the USERS.PASSWORD_HASH VARCHAR2(255 BYTE) column.
/// No reversible encryption, plaintext storage, or password logging.
/// </summary>
public sealed class PasswordHasher : IPawCarePasswordHasher
{
    private const string Scheme = "pbkdf2-sha256";
    private const int CurrentIterations = 600_000;
    private const int MinimumAcceptedIterations = 300_000; // for controlled, earlier hashes only
    private const int MaximumAcceptedIterations = 1_200_000; // bound verify CPU usage
    private const int SaltLength = 16;
    private const int HashLength = 32;

    public string HashPassword(string password)
    {
        ArgumentNullException.ThrowIfNull(password);
        // Align with Common/Validators.cs. Do not trim or normalize passwords.
        if (password.Length is < 12 or > 128)
        {
            throw new ArgumentException("Password must contain 12 to 128 characters.", nameof(password));
        }

        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var derived = Rfc2898DeriveBytes.Pbkdf2(
            password, salt, CurrentIterations, HashAlgorithmName.SHA256, HashLength);

        return $"{Scheme}${CurrentIterations.ToString(CultureInfo.InvariantCulture)}" +
               $"${Convert.ToBase64String(salt)}${Convert.ToBase64String(derived)}";
    }

    public PasswordVerificationOutcome VerifyPassword(string? encodedHash, string? suppliedPassword)
    {
        if (string.IsNullOrWhiteSpace(encodedHash) ||
            suppliedPassword is null || suppliedPassword.Length is < 1 or > 128 ||
            encodedHash.Length > 255)
        {
            return PasswordVerificationOutcome.Failed;
        }

        // Invalid or unknown hashes (including disabled demo accounts) always fail.
        var fields = encodedHash.Split('$');
        if (fields.Length != 4 || !string.Equals(fields[0], Scheme, StringComparison.Ordinal) ||
            !int.TryParse(fields[1], NumberStyles.None, CultureInfo.InvariantCulture, out var iterations) ||
            iterations is < MinimumAcceptedIterations or > MaximumAcceptedIterations)
        {
            return PasswordVerificationOutcome.Failed;
        }

        try
        {
            var salt = Convert.FromBase64String(fields[2]);
            var expected = Convert.FromBase64String(fields[3]);
            if (salt.Length != SaltLength || expected.Length != HashLength)
            {
                return PasswordVerificationOutcome.Failed;
            }

            var actual = Rfc2898DeriveBytes.Pbkdf2(
                suppliedPassword, salt, iterations, HashAlgorithmName.SHA256, HashLength);

            if (!CryptographicOperations.FixedTimeEquals(actual, expected))
            {
                return PasswordVerificationOutcome.Failed;
            }

            return iterations < CurrentIterations
                ? PasswordVerificationOutcome.SuccessRehashNeeded
                : PasswordVerificationOutcome.Success;
        }
        catch (FormatException)
        {
            return PasswordVerificationOutcome.Failed;
        }
    }
}
