namespace PawCare.Api.Configuration;

/// <summary>
/// Oracle-only connection settings. Binds directly to ConnectionStrings:PawCare;
/// the connection string is a secret and must never be logged or returned by an API.
/// </summary>
public sealed class OracleDatabaseOptions
{
    public const string SectionName = "ConnectionStrings";

    public string PawCare { get; set; } = string.Empty;
}

/// <summary>
/// Bearer token validation settings. These names match Program.cs and appsettings.json.
/// Only the backend may access SigningKey; never expose it to web or mobile clients.
/// </summary>
public sealed class PawCareJwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string SigningKey { get; set; } = string.Empty;
}

/// <summary>
/// Explicit browser origins only. Native mobile applications do not require CORS.
/// </summary>
public sealed class PawCareCorsOptions
{
    public const string SectionName = "Cors";

    public string[] AllowedOrigins { get; set; } = [];
}

/// <summary>
/// Default request limit for the current one-minute API rate limiter.
/// More restrictive limits for authentication and payments belong to feature modules.
/// </summary>
public sealed class PawCareRateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public int RequestsPerMinute { get; set; } = 120;
}

/// <summary>
/// Timeout used by the Oracle readiness probe (not an Oracle connection-pool setting).
/// </summary>
public sealed class PawCareHealthOptions
{
    public const string SectionName = "Health";

    public int OracleTimeoutSeconds { get; set; } = 5;
}

/// <summary>
/// OpenAPI is intended for Development only. Program.cs also enforces this boundary.
/// </summary>
public sealed class PawCareOpenApiOptions
{
    public const string SectionName = "OpenApi";

    public bool Enabled { get; set; } = false;
}
