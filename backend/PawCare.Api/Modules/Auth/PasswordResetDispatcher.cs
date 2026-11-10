using System.Threading.Channels;
using PawCare.Api.Infrastructure.Email;

namespace PawCare.Api.Modules.Auth;

/// <summary>
/// Non-persistent bounded in-memory queue: sends after the HTTP 202 response to
/// reduce email-provider timing differences between known and unknown accounts.
/// A container crash may lose queued emails; production should use a durable,
/// encrypted dispatch mechanism that never logs or exposes raw reset tokens.
/// </summary>
public interface IPasswordResetDispatcher
{
    bool TryQueue(EmailMessage message);
}

public sealed class PasswordResetDispatcher(
    IEmailGateway email, ILogger<PasswordResetDispatcher> logger)
    : BackgroundService, IPasswordResetDispatcher
{
    private readonly Channel<EmailMessage> _messages = Channel.CreateBounded<EmailMessage>(
        new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        });

    public bool TryQueue(EmailMessage message) => _messages.Writer.TryWrite(message);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var message in _messages.Reader.ReadAllAsync(stoppingToken))
            {
                try { await email.SendAsync(message, stoppingToken); }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception error)
                {
                    // Never log the message, recipient or raw token-bearing URL.
                    logger.LogWarning("Password recovery email delivery failed ({ErrorType}).",
                        error.GetType().Name);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal host shutdown: in-memory queued messages may be lost.
        }
    }
}
