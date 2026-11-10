using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace PawCare.Api.Middleware;

/// <summary>
/// Gives every request a new server-generated correlation identifier. An incoming
/// X-Request-ID is deliberately not trusted; clients cannot impersonate another
/// request or inject arbitrary data into structured logs.
/// </summary>
public sealed class RequestIdMiddleware
{
    public const string HeaderName = "X-Request-ID";
    public const string ItemKey = "PawCare.RequestId";

    private readonly RequestDelegate _next;
    private readonly ILogger<RequestIdMiddleware> _logger;

    public RequestIdMiddleware(RequestDelegate next, ILogger<RequestIdMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = $"req_{Guid.NewGuid():N}";
        context.TraceIdentifier = requestId;
        context.Items[ItemKey] = requestId;
        context.Response.Headers[HeaderName] = requestId;

        // OnStarting also covers downstream handlers that clear or replace headers.
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = requestId;
            return Task.CompletedTask;
        });

        using (_logger.BeginScope(new Dictionary<string, object>
        {
            ["RequestId"] = requestId
        }))
        {
            await _next(context);
        }
    }
}
