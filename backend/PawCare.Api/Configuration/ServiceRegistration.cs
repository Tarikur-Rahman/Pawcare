using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Oracle.ManagedDataAccess.Client;

namespace PawCare.Api.Configuration;

/// <summary>
/// Registers shared configuration and infrastructure that are available today.
/// JWT authentication, CORS middleware, rate limiting, OpenAPI and health endpoints
/// are ALREADY registered by the existing Program.cs; do not register them twice.
/// Call builder.Services.AddPawCareServices(builder.Configuration, builder.Environment)
/// after WebApplication.CreateBuilder(args), before builder.Build().
/// </summary>
public static class ServiceRegistration
{
    public static IServiceCollection AddPawCareServices(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);

        services.AddOptions<OracleDatabaseOptions>()
            .Bind(configuration.GetSection(OracleDatabaseOptions.SectionName))
            // The existing development bootstrap permits an unconfigured Oracle DB,
            // so /api/health can start while /api/health/ready returns unavailable.
            .Validate(
                options => environment.IsDevelopment() || !string.IsNullOrWhiteSpace(options.PawCare),
                "ConnectionStrings:PawCare must be configured outside Development.")
            .ValidateOnStart();

        services.AddOptions<PawCareJwtOptions>()
            .Bind(configuration.GetSection(PawCareJwtOptions.SectionName))
            .Validate(ValidJwtOptions,
                "Jwt:Issuer, Jwt:Audience and a private signing key of at least 32 UTF-8 bytes are required.")
            .ValidateOnStart();

        services.AddOptions<PawCareCorsOptions>()
            .Bind(configuration.GetSection(PawCareCorsOptions.SectionName))
            .Validate(
                options => options.AllowedOrigins is not null &&
                           options.AllowedOrigins.All(origin => ValidCorsOrigin(origin, environment.IsDevelopment())),
                "Cors:AllowedOrigins must contain explicit origins (HTTPS outside Development), without paths or wildcards.")
            .ValidateOnStart();

        services.AddOptions<PawCareRateLimitingOptions>()
            .Bind(configuration.GetSection(PawCareRateLimitingOptions.SectionName))
            .Validate(options => options.RequestsPerMinute is >= 10 and <= 2000,
                "RateLimiting:RequestsPerMinute must be between 10 and 2000.")
            .ValidateOnStart();

        services.AddOptions<PawCareHealthOptions>()
            .Bind(configuration.GetSection(PawCareHealthOptions.SectionName))
            .Validate(options => options.OracleTimeoutSeconds is >= 1 and <= 30,
                "Health:OracleTimeoutSeconds must be between 1 and 30.")
            .ValidateOnStart();

        services.AddOptions<PawCareOpenApiOptions>()
            .Bind(configuration.GetSection(PawCareOpenApiOptions.SectionName))
            .Validate(options => environment.IsDevelopment() || !options.Enabled,
                "OpenApi:Enabled must be false outside Development.")
            .ValidateOnStart();

        // The factory creates CLOSED Oracle connections; repositories must open and
        // dispose each connection, and should use async operations with cancellation.
        services.TryAddSingleton<IOracleConnectionFactory, OracleConnectionFactory>();
        services.TryAddSingleton<TimeProvider>(TimeProvider.System);

        return services;
    }

    private static bool ValidJwtOptions(PawCareJwtOptions options) =>
        !string.IsNullOrWhiteSpace(options.Issuer) &&
        !string.IsNullOrWhiteSpace(options.Audience) &&
        !string.IsNullOrWhiteSpace(options.SigningKey) &&
        !options.SigningKey.StartsWith("REPLACE_", StringComparison.OrdinalIgnoreCase) &&
        Encoding.UTF8.GetByteCount(options.SigningKey) >= 32;

    private static bool ValidCorsOrigin(string? origin, bool development)
    {
        if (string.IsNullOrWhiteSpace(origin) || origin.Contains('*') ||
            !Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme != Uri.UriSchemeHttps &&
            !(development && uri.Scheme == Uri.UriSchemeHttp))
        {
            return false;
        }

        // The CORS middleware expects origins, not URLs with paths, credentials,
        // wildcards, query strings or fragments.
        return string.IsNullOrEmpty(uri.UserInfo) &&
               string.Equals(origin, uri.GetLeftPart(UriPartial.Authority),
                   StringComparison.OrdinalIgnoreCase);
    }
}

/// <summary>Provides an un-opened connection to the configured Oracle schema.</summary>
public interface IOracleConnectionFactory
{
    OracleConnection CreateConnection();
}

/// <summary>
/// No Oracle user/password is stored in code. The connection string comes from
/// ConnectionStrings:PawCare, which should be supplied through a secret store or
/// environment variables outside local development.
/// </summary>
internal sealed class OracleConnectionFactory(IOptionsMonitor<OracleDatabaseOptions> options)
    : IOracleConnectionFactory
{
    public OracleConnection CreateConnection()
    {
        var connectionString = options.CurrentValue.PawCare;
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Oracle database connection is not configured.");
        }

        // The caller owns the connection lifetime; this method never opens it.
        return new OracleConnection(connectionString);
    }
}
