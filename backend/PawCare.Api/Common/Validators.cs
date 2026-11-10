using System.Net.Mail;

namespace PawCare.Api.Common;

/// <summary>Aggregates safe, field-specific errors without echoing rejected input.</summary>
public sealed class ValidationBag
{
    private readonly Dictionary<string, List<string>> _fields = new(StringComparer.Ordinal);

    public bool HasErrors => _fields.Count > 0;

    public void Add(string field, string message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(field);
        ArgumentException.ThrowIfNullOrWhiteSpace(message);

        if (!_fields.TryGetValue(field, out var messages))
        {
            messages = new List<string>();
            _fields.Add(field, messages);
        }

        if (!messages.Contains(message, StringComparer.Ordinal)) messages.Add(message);
    }

    public IReadOnlyDictionary<string, string[]> ToFieldErrors() =>
        _fields.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray(), StringComparer.Ordinal);

    public DomainError ToDomainError() => HasErrors
        ? DomainErrors.ValidationFailed(ToFieldErrors())
        : throw new InvalidOperationException("There are no validation errors to report.");
}

/// <summary>
/// Shared input shape checks for requests. Feature-specific permissions, lifecycle
/// rules, and DB uniqueness checks belong to service/repository implementations.
/// </summary>
public static class Validators
{
    public static void RequiredText(
        string? value,
        string field,
        ValidationBag errors,
        int minLength = 1,
        int maxLength = 200)
    {
        ArgumentNullException.ThrowIfNull(errors);
        if (minLength < 1 || maxLength < minLength)
            throw new ArgumentOutOfRangeException(nameof(maxLength));

        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add(field, "This field is required.");
            return;
        }

        var trimmed = value.Trim();
        if (trimmed.Length < minLength || trimmed.Length > maxLength)
        {
            errors.Add(field, $"Use between {minLength} and {maxLength} characters.");
        }
        if (trimmed.Any(char.IsControl))
        {
            errors.Add(field, "Control characters are not allowed.");
        }
    }

    public static void Email(string? value, string field, ValidationBag errors)
    {
        ArgumentNullException.ThrowIfNull(errors);
        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add(field, "Email is required.");
            return;
        }

        // MailAddress is a shape check, NOT proof of ownership or deliverability.
        var candidate = value.Trim();
        if (candidate.Length > 254 || candidate.Any(char.IsControl) ||
            !MailAddress.TryCreate(candidate, out var parsed) ||
            !string.Equals(parsed.Address, candidate, StringComparison.Ordinal) ||
            !candidate.Contains('@'))
        {
            errors.Add(field, "Enter a valid email address.");
        }
    }

    public static void Password(string? value, string field, ValidationBag errors)
    {
        ArgumentNullException.ThrowIfNull(errors);
        // Length-only baseline: avoid arbitrary complexity rules; check breached
        // passwords and rate-limit credential attempts in the identity module.
        if (string.IsNullOrEmpty(value) || value.Length < 12 || value.Length > 128)
        {
            errors.Add(field, "Use a password between 12 and 128 characters.");
        }
    }

    public static void PositiveId(long? value, string field, ValidationBag errors)
    {
        ArgumentNullException.ThrowIfNull(errors);
        // Database record IDs are positive 64-bit integers; API route IDs may be
        // opaque strings and must be parsed by their feature endpoint separately.
        if (value is null or <= 0) errors.Add(field, "Select a valid record.");
    }

    public static void MoneyMinor(long? value, string field, ValidationBag errors, bool allowZero = true)
    {
        ArgumentNullException.ThrowIfNull(errors);
        if (value is null || value < 0 || (!allowZero && value == 0))
        {
            errors.Add(field, allowZero ? "Amount must be zero or greater." : "Amount must be greater than zero.");
        }
    }

    public static void Currency(string? value, string field, ValidationBag errors)
    {
        ArgumentNullException.ThrowIfNull(errors);
        // Shape only. An approved ISO 4217 code and its minor-unit scale must be
        // verified using the application currency registry before any transaction.
        if (value is null || value.Length != 3 || value.Any(character => character is < 'A' or > 'Z'))
        {
            errors.Add(field, "Use a three-letter uppercase currency code.");
        }
    }

    public static void UtcTimestamp(DateTimeOffset? value, string field, ValidationBag errors)
    {
        ArgumentNullException.ThrowIfNull(errors);
        if (value is null || value.Value.Offset != TimeSpan.Zero)
        {
            errors.Add(field, "Supply a UTC timestamp (offset +00:00).");
        }
    }

    public static void NumberInRange(int? value, string field, ValidationBag errors, int min, int max)
    {
        ArgumentNullException.ThrowIfNull(errors);
        if (min > max) throw new ArgumentOutOfRangeException(nameof(min));
        if (value is null || value < min || value > max)
        {
            errors.Add(field, $"Value must be between {min} and {max}.");
        }
    }
}
