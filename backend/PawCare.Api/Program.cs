using PawCare.Api.Configuration;
using PawCare.Api.Security;
using PawCare.Api.Middleware;
using PawCare.Api.Infrastructure.Database;
using PawCare.Api.Infrastructure.Storage;
using PawCare.Api.Infrastructure.Payments;
using PawCare.Api.Infrastructure.Notifications;
using PawCare.Api.Infrastructure.Email;
using PawCare.Api.Infrastructure.Clock;
using PawCare.Api.Workers;
using PawCare.Api.Modules;
using PawCare.Api.Modules.Auth;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Oracle.ManagedDataAccess.Client;

// The optional local .env file is read ONLY when Development is explicitly set.
// Do not rely on .env for staging/production: supply environment variables or a secret store.
var environmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
    ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
    ?? "Production";
if (string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase))
{
    LoadDevelopmentEnv(Path.Combine(Directory.GetCurrentDirectory(), ".env"));
}

var builder = WebApplication.CreateBuilder(args);

// Shared typed settings and Oracle-only infrastructure.
builder.Services.AddPawCareServices(builder.Configuration, builder.Environment);

// The API uses Oracle exclusively; the browser and mobile apps never access Oracle directly.
var dbConnectionString = builder.Configuration.GetConnectionString("PawCare");
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];
var signingKey = builder.Configuration["Jwt:SigningKey"];

if (string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience))
{
    throw new InvalidOperationException("Set Jwt:Issuer and Jwt:Audience before starting PawCare.Api.");
}
if (string.IsNullOrWhiteSpace(signingKey) || signingKey.StartsWith("REPLACE_", StringComparison.OrdinalIgnoreCase)
    || Encoding.UTF8.GetByteCount(signingKey) < 32)
{
    throw new InvalidOperationException(
        "Jwt:SigningKey must be a private, randomly generated secret of at least 32 UTF-8 bytes. " +
        "Provide it through the environment or a secret manager.");
}
if (!builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(dbConnectionString))
{
    throw new InvalidOperationException("Set ConnectionStrings:PawCare for the Oracle database.");
}

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // Keep wire claim names: sub, role.
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
            RoleClaimType = "role",
            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 }
        };

        // Keep authentication errors consistent with PawCare's API error contract.
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "UNAUTHORIZED",
                    message = "Authentication is required.",
                    fieldErrors = new Dictionary<string, string[]>(),
                    requestId = context.HttpContext.TraceIdentifier
                });
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "FORBIDDEN",
                    message = "You do not have permission to perform this action.",
                    fieldErrors = new Dictionary<string, string[]>(),
                    requestId = context.HttpContext.TraceIdentifier
                });
            }
        };
    });

// Security policies and password/token/ownership services; register once.
builder.Services.AddPawCareSecurity();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins")
    .GetChildren()
    .Select(child => child.Value)
    .Where(value => !string.IsNullOrWhiteSpace(value))
    .Cast<string>()
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("PawCareWeb", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
        // No wildcard origin or cross-origin cookie credentials by default.
    });
});

var requestsPerMinute = Math.Clamp(builder.Configuration.GetValue("RateLimiting:RequestsPerMinute", 120), 10, 2000);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.User.Identity?.IsAuthenticated == true
                ? httpContext.User.FindFirst("sub")?.Value ?? "authenticated-no-sub"
                : httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = requestsPerMinute,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    // Separate abuse budget for anonymous password recovery endpoints.
    options.AddPolicy("password-recovery", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(15),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            code = "RATE_LIMITED",
            message = "Too many requests. Try again shortly.",
            fieldErrors = new Dictionary<string, string[]>(),
            requestId = context.HttpContext.TraceIdentifier
        }, cancellationToken);
    };
});

// Reuse the registered Oracle connection provider for every feature module.
builder.Services.AddScoped<IPawCareDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddScoped<ISqlTransactionRunner, SqlTransactionRunner>();
builder.Services.AddScoped<MigrationRunner>();

// External gateways are fail-closed until real provider configuration exists.
builder.Services.AddSingleton<IPaymentGateway, PaymentGateway>();
builder.Services.AddHttpClient<IPushGateway, ExpoPushGateway>();
builder.Services.AddTransient<IEmailGateway, EmailGateway>();
// Background dispatch makes account recovery independent of SMTP response timing.
builder.Services.AddSingleton<PasswordResetDispatcher>();
builder.Services.AddSingleton<IPasswordResetDispatcher>(sp => sp.GetRequiredService<PasswordResetDispatcher>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<PasswordResetDispatcher>());
builder.Services.AddSingleton<ISystemClock, SystemClock>();
if (builder.Environment.IsDevelopment())
{
    // Private local quarantine ONLY; never configured as publicly served files.
    builder.Services.AddSingleton<IObjectStorage, ObjectStorage>();
}

// Safe defaults: all workers are disabled unless explicitly enabled in settings.
builder.Services.AddHostedService<ReminderWorker>();
builder.Services.AddHostedService<OutboxWorker>();
builder.Services.AddHostedService<InventoryReconcileWorker>();

// The 22 feature modules use the shared services above.
builder.Services.AddPawCareFeatureModules();

var app = builder.Build();

// One request-ID source and one centralized exception response handler.
// Audit wraps ErrorHandler so final status codes are visible to the audit logger.
app.UseMiddleware<RequestIdMiddleware>();
app.UseMiddleware<AuditMiddleware>();
app.UseMiddleware<ErrorHandler>();

// Production HTTPS should be terminated by a trusted edge/reverse proxy; configure
// forwarded headers ONLY for known proxies as part of the deployment integration.
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors("PawCareWeb");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment() && builder.Configuration.GetValue("OpenApi:Enabled", true))
{
    app.MapOpenApi(); // GET /openapi/v1.json — development only
}

// Liveness confirms the process is responding; it deliberately does not probe Oracle.
app.MapGet("/api/health", (HttpContext context) => Results.Ok(new
{
    data = new { status = "ok", service = "PawCare.Api" },
    requestId = context.TraceIdentifier
}))
.AllowAnonymous()
.WithTags("Health")
.WithName("ApiHealth");

// Readiness confirms the Oracle connection and all V001-V014 schema versions.
app.MapGet("/api/health/ready", async (HttpContext context, IConfiguration configuration, ILoggerFactory loggerFactory) =>
{
    var connectionString = configuration.GetConnectionString("PawCare");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return NotReady(context);
    }

    var timeoutSeconds = Math.Clamp(configuration.GetValue("Health:OracleTimeoutSeconds", 5), 1, 30);
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
    timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

    try
    {
        using var connection = new OracleConnection(connectionString);
        await connection.OpenAsync(timeout.Token);
        using var command = connection.CreateCommand();
        command.CommandTimeout = timeoutSeconds;
        command.CommandText = """
            SELECT COUNT(*)
              FROM SCHEMA_MIGRATIONS
             WHERE provider = 'ORACLE'
               AND migration_version IN (
                 'V001', 'V002', 'V003', 'V004', 'V005', 'V006',
                 'V007', 'V008', 'V009', 'V010', 'V011', 'V012', 'V013', 'V014'
               )
            """;
        var result = await command.ExecuteScalarAsync(timeout.Token);
        if (Convert.ToInt32(result) != 14)
        {
            return NotReady(context);
        }

        return Results.Ok(new
        {
            data = new { status = "ready", database = "oracle" },
            requestId = context.TraceIdentifier
        });
    }
    catch (Exception exception) when (
        exception is OracleException or TimeoutException or OperationCanceledException or InvalidOperationException)
    {
        loggerFactory.CreateLogger("PawCare.Readiness")
            .LogWarning("Oracle readiness check failed ({ExceptionType}).", exception.GetType().Name);
        return NotReady(context);
    }
})
.AllowAnonymous()
.WithTags("Health")
.WithName("ApiReadiness");

// All feature modules are explicitly mapped after authentication/authorization.
app.MapPawCareFeatureModules();
app.Run();

static IResult NotReady(HttpContext context) => Results.Json(new
{
    code = "SERVICE_NOT_READY",
    message = "PawCare is temporarily unavailable.",
    fieldErrors = new Dictionary<string, string[]>(),
    requestId = context.TraceIdentifier
}, statusCode: StatusCodes.Status503ServiceUnavailable);

static void LoadDevelopmentEnv(string path)
{
    if (!File.Exists(path)) return;

    foreach (var line in File.ReadLines(path))
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith('#')) continue;
        if (trimmed.StartsWith("export ", StringComparison.Ordinal)) trimmed = trimmed[7..].TrimStart();
        var separator = trimmed.IndexOf('=');
        if (separator <= 0) continue;
        var key = trimmed[..separator].Trim();
        var value = trimmed[(separator + 1)..].Trim();
        if (value.Length >= 2 &&
            ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
        {
            value = value[1..^1];
        }
        // Explicit shell variables take precedence over this local development file.
        if (Environment.GetEnvironmentVariable(key) is null)
        {
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
