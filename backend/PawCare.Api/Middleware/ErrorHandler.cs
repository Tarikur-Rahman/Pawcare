using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using PawCare.Api.Common;

namespace PawCare.Api.Middleware;

/// <summary>
/// Converts DomainException to the PawCare API error envelope and masks unexpected
/// failures. Never sends exception details, stack traces, SQL or credentials to clients.
/// Place after RequestIdMiddleware and AuditMiddleware in the request pipeline.
/// </summary>
public sealed class ErrorHandler
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandler> _logger;

    public ErrorHandler(RequestDelegate next, ILogger<ErrorHandler> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DomainException exception)
        {
            if (context.RequestAborted.IsCancellationRequested)
            {
                _logger.LogDebug("Request {RequestId} was cancelled by the client.", context.TraceIdentifier);
                return;
            }

            if (context.Response.HasStarted)
            {
                _logger.LogError("Cannot render domain error for {RequestId}: response started.",
                    context.TraceIdentifier);
                throw;
            }

            var error = exception.Error;
            _logger.LogWarning(
                "Domain failure {ErrorCode}, HTTP {StatusCode}, request {RequestId}.",
                error.Code, error.HttpStatus, context.TraceIdentifier);
            await WriteErrorAsync(context, error);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The connection is gone: do not try to write an error to it.
            _logger.LogDebug("Request {RequestId} was cancelled by the client.", context.TraceIdentifier);
        }
        catch (Exception exception)
        {
            if (context.RequestAborted.IsCancellationRequested)
            {
                _logger.LogDebug("Request {RequestId} ended after client cancellation.", context.TraceIdentifier);
                return;
            }

            if (context.Response.HasStarted)
            {
                _logger.LogError("Cannot render error for {RequestId}: response started ({ExceptionType}).",
                    context.TraceIdentifier, exception.GetType().Name);
                throw;
            }

            // Do not log exception.Message or the full exception here: provider
            // errors may contain SQL, secret values or private user information.
            _logger.LogError("Unhandled failure {ExceptionType}, request {RequestId}.",
                exception.GetType().Name, context.TraceIdentifier);
            await WriteErrorAsync(context, new DomainError(
                "INTERNAL_ERROR", "An unexpected error occurred.",
                StatusCodes.Status500InternalServerError));
        }
    }

    private static async Task WriteErrorAsync(HttpContext context, DomainError error)
    {
        // Safe only when HasStarted is false. Clears stale Content-Length/Location,
        // then restores the correlation header and private-response cache policy.
        context.Response.Clear();
        context.Response.StatusCode = error.HttpStatus;
        context.Response.Headers[RequestIdMiddleware.HeaderName] = context.TraceIdentifier;
        context.Response.Headers.CacheControl = "no-store";
        await context.Response.WriteAsJsonAsync(
            new ApiErrorResult(error.Code, error.Message, error.FieldErrors,
                context.TraceIdentifier),
            cancellationToken: context.RequestAborted);
    }
}
