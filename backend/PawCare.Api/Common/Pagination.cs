using System.Globalization;
using System.Text.Json.Serialization;

namespace PawCare.Api.Common;

/// <summary>
/// Validated 1-based pagination. Always sort SQL results deterministically
/// (for example, CREATED_AT DESC, ID DESC) before applying OFFSET/FETCH.
/// </summary>
public sealed class Pagination
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public int Page { get; }
    public int PageSize { get; }

    /// <summary>64-bit OFFSET avoids overflow for large (but valid) page numbers.</summary>
    public long Offset => ((long)Page - 1) * PageSize;

    private Pagination(int page, int pageSize)
    {
        Page = page;
        PageSize = pageSize;
    }

    /// <summary>
    /// Parses raw query-string values without relying on a framework-generated
    /// 400 response, so callers can return PawCare's standard error envelope.
    /// Null means omitted; empty, signed, nonnumeric, or out-of-range values fail.
    /// </summary>
    public static bool TryParse(
        string? rawPage,
        string? rawPageSize,
        out Pagination? pagination,
        out DomainError? error)
    {
        var fields = new ValidationBag();
        var page = DefaultPage;
        var pageSize = DefaultPageSize;

        if (rawPage is not null &&
            (!int.TryParse(rawPage, NumberStyles.None, CultureInfo.InvariantCulture, out page) || page < 1))
        {
            fields.Add("page", "Page must be a positive whole number.");
        }

        if (rawPageSize is not null &&
            (!int.TryParse(rawPageSize, NumberStyles.None, CultureInfo.InvariantCulture, out pageSize)
             || pageSize < 1 || pageSize > MaxPageSize))
        {
            fields.Add("pageSize", $"Page size must be between 1 and {MaxPageSize}.");
        }

        if (fields.HasErrors)
        {
            pagination = null;
            error = DomainErrors.InvalidQuery(fields.ToFieldErrors());
            return false;
        }

        pagination = new Pagination(page, pageSize);
        error = null;
        return true;
    }
}

/// <summary>Top-level list envelope required by PawCare's API contract.</summary>
public sealed record ApiPage<T>(
    [property: JsonPropertyName("items")] IReadOnlyList<T> Items,
    [property: JsonPropertyName("page")] int Page,
    [property: JsonPropertyName("pageSize")] int PageSize,
    [property: JsonPropertyName("total")] long Total,
    [property: JsonPropertyName("requestId")] string RequestId);
