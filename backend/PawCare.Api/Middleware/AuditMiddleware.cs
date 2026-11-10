using System.Diagnostics;
using System.Globalization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;

namespace PawCare.Api.Middleware;

/// <summary>
/// Produces a privacy-minimized request audit log for state-changing API calls.
/// This is operational telemetry, NOT a durable substitute for Oracle AUDIT_EVENTS:
/// feature services must insert business audit events in their own transactions.
/// Do not record request/response bodies, query strings, cookies, tokens or IPs.
/// </summary>
public sealed class AuditMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditMiddleware> _logger;

    public AuditMiddleware(RequestDelegate next, ILogger<AuditMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!IsAuditedMutation(context.Request))
        {
            await _next(context);
            return;
        }

        var startedAt = Stopwatch.GetTimestamp();
        var completed = false;
        try
        {
            await _next(context);
            completed = true;
        }
        finally
        {
            // A request may fail before routing, so avoid logging the raw URL:
            // it could contain private identifiers or untrusted path segments.
            var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText
                        ?? "<unmatched>";
            var actorId = GetAuthenticatedActorId(context);
            var status = context.RequestAborted.IsCancellationRequested
                ? 499 // Log-only convention: client closed request (never an HTTP response).
                : completed ? context.Response.StatusCode
                : StatusCodes.Status500InternalServerError;
            var durationMs = Math.Round(Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds, 1);

            if (status >= 400)
            {
                _logger.LogWarning(
                    "API mutation audit: {Method} {Route} -> {StatusCode}; actor={ActorId}; " +
                    "request={RequestId}; elapsedMs={ElapsedMs}.",
                    context.Request.Method, route, status, actorId,
                    context.TraceIdentifier, durationMs);
            }
            else
            {
                _logger.LogInformation(
                    "API mutation audit: {Method} {Route} -> {StatusCode}; actor={ActorId}; " +
                    "request={RequestId}; elapsedMs={ElapsedMs}.",
                    context.Request.Method, route, status, actorId,
                    context.TraceIdentifier, durationMs);
            }
        }
    }

    private static bool IsAuditedMutation(HttpRequest request)
    {
        // Do not log every GET/read or infrastructure heartbeat. Additional
        // security-sensitive reads can be audited explicitly by feature services.
        if (!HttpMethods.IsPost(request.Method) &&
            !HttpMethods.IsPut(request.Method) &&
            !HttpMethods.IsPatch(request.Method) &&
            !HttpMethods.IsDelete(request.Method))
        {
            return false;
        }

        return request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase);
    }

    private static long? GetAuthenticatedActorId(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        // USERS.USER_ID is an Oracle NUMBER(19). Never treat a supplied request
        // parameter or an unauthenticated claim as the acting user.
        var subject = context.User.FindFirst("sub")?.Value;
        return long.TryParse(subject, NumberStyles.None, CultureInfo.InvariantCulture,
            out var id) && id > 0 ? id : null;
    }
}
