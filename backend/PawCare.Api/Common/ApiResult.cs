using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace PawCare.Api.Common;

/// <summary>Canonical single-resource success envelope for /api/v1 endpoints.</summary>
public sealed record ApiResult<T>(
    [property: JsonPropertyName("data")] T Data,
    [property: JsonPropertyName("requestId")] string RequestId);

/// <summary>Canonical error envelope. Never include stack traces or private data.</summary>
public sealed record ApiErrorResult(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("fieldErrors")] IReadOnlyDictionary<string, string[]> FieldErrors,
    [property: JsonPropertyName("requestId")] string RequestId);

/// <summary>
/// Minimal API response helpers. A null or empty result is not automatically a 404;
/// endpoints must perform their own authorization and existence checks.
/// </summary>
public static class ApiResponses
{
    public static IResult Ok<T>(HttpContext context, T data)
    {
        ArgumentNullException.ThrowIfNull(context);
        return Results.Ok(new ApiResult<T>(data, context.TraceIdentifier));
    }

    public static IResult Created<T>(HttpContext context, string location, T data)
    {
        ArgumentNullException.ThrowIfNull(context);
        // Only local application routes should become a Location header.
        if (string.IsNullOrWhiteSpace(location) || !location.StartsWith('/') ||
            location.StartsWith("//") || location.Any(char.IsControl))
        {
            throw new ArgumentException("Location must be an application-relative path.", nameof(location));
        }

        return Results.Created(location, new ApiResult<T>(data, context.TraceIdentifier));
    }

    public static IResult Page<T>(
        HttpContext context,
        IReadOnlyList<T> items,
        Pagination pagination,
        long total)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(pagination);
        if (total < 0) throw new ArgumentOutOfRangeException(nameof(total));
        if (items.Count > pagination.PageSize)
            throw new ArgumentException("A page cannot contain more items than the requested page size.", nameof(items));

        return Results.Ok(new ApiPage<T>(items, pagination.Page, pagination.PageSize, total, context.TraceIdentifier));
    }

    public static IResult Error(HttpContext context, DomainError error)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(error);
        context.Response.Headers["Cache-Control"] = "no-store";

        return Results.Json(
            new ApiErrorResult(error.Code, error.Message, error.FieldErrors, context.TraceIdentifier),
            statusCode: error.HttpStatus);
    }
}
