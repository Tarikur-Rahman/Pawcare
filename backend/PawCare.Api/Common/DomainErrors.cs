using Microsoft.AspNetCore.Http;

namespace PawCare.Api.Common;

/// <summary>
/// A safe, public-facing domain failure. Never embed SQL, credentials,
/// private identities, provider errors, or exception details in Message.
/// </summary>
public sealed class DomainError
{
    public string Code { get; }
    public string Message { get; }
    public int HttpStatus { get; }
    public IReadOnlyDictionary<string, string[]> FieldErrors { get; }

    public DomainError(
        string code,
        string message,
        int httpStatus,
        IReadOnlyDictionary<string, string[]>? fieldErrors = null)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Error code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(message)) throw new ArgumentException("Error message is required.", nameof(message));
        if (httpStatus < 400 || httpStatus > 599)
            throw new ArgumentOutOfRangeException(nameof(httpStatus), "An error must use an HTTP 4xx or 5xx status.");

        Code = code;
        Message = message;
        HttpStatus = httpStatus;
        // Copy each array so a caller cannot alter a result after its creation.
        FieldErrors = fieldErrors?.ToDictionary(
            pair => pair.Key,
            pair => pair.Value?.ToArray() ?? Array.Empty<string>(),
            StringComparer.Ordinal) ?? new Dictionary<string, string[]>(StringComparer.Ordinal);
    }
}

/// <summary>
/// Standard domain error constructors; feature modules may add more specific codes.
/// 404 is preferred to 403 when revealing a private resource's existence is unsafe.
/// </summary>
public static class DomainErrors
{
    public static DomainError InvalidQuery(IReadOnlyDictionary<string, string[]> fields) =>
        new("INVALID_QUERY", "Check the supplied query parameters.", StatusCodes.Status400BadRequest, fields);

    public static DomainError ValidationFailed(IReadOnlyDictionary<string, string[]> fields) =>
        new("VALIDATION_FAILED", "Please correct the highlighted fields.", StatusCodes.Status422UnprocessableEntity, fields);

    public static DomainError Unauthorized() =>
        new("UNAUTHORIZED", "Authentication is required.", StatusCodes.Status401Unauthorized);

    public static DomainError Forbidden() =>
        new("FORBIDDEN", "You do not have permission to perform this action.", StatusCodes.Status403Forbidden);

    public static DomainError NotFound() =>
        new("NOT_FOUND", "The requested resource was not found.", StatusCodes.Status404NotFound);

    public static DomainError Conflict(string code = "CONFLICT", string message = "This operation conflicts with the current resource state.") =>
        new(code, message, StatusCodes.Status409Conflict);

    public static DomainError RateLimited() =>
        new("RATE_LIMITED", "Too many requests. Try again shortly.", StatusCodes.Status429TooManyRequests);

    public static DomainError ServiceUnavailable() =>
        new("SERVICE_NOT_READY", "PawCare is temporarily unavailable.", StatusCodes.Status503ServiceUnavailable);
}

/// <summary>
/// Optional domain exception for service-layer use. The current bootstrap Program.cs
/// handles unhandled exceptions as HTTP 500; a future centralized exception mapper
/// must explicitly catch this type before throwing it from endpoint services.
/// Prefer returning DomainError with ApiResponses.Error until that mapper exists.
/// </summary>
public sealed class DomainException : Exception
{
    public DomainError Error { get; }

    public DomainException(DomainError error)
        : base((error ?? throw new ArgumentNullException(nameof(error))).Message)
    {
        Error = error;
    }
}
