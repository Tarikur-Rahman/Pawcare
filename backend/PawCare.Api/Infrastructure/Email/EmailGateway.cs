using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace PawCare.Api.Infrastructure.Email;

/// <summary>
/// Email messages are plain-text only, so content is not interpreted as HTML.
/// Keep recipients and body out of application logs.
/// </summary>
public interface IEmailGateway
{
    Task<EmailSubmission> SendAsync(EmailMessage message,
        CancellationToken cancellationToken = default);
}

public sealed record EmailMessage(string To, string Subject, string PlainTextBody);

/// <summary>
/// "AcceptedBySmtp" is not proof that the recipient received or opened mail.
/// </summary>
public sealed record EmailSubmission(string Status);

/// <summary>
/// Basic SMTP adapter without additional NuGet dependencies. Enforces STARTTLS,
/// explicit credentials and an approved sender. Disabled by default.
/// For production, prefer a modern email provider/MailKit adapter with OAuth,
/// idempotent delivery through the Oracle outbox, and delivery webhooks.
/// </summary>
public sealed class EmailGateway(IConfiguration configuration) : IEmailGateway
{
    public async Task<EmailSubmission> SendAsync(EmailMessage message,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);
        cancellationToken.ThrowIfCancellationRequested();
        if (!configuration.GetValue("Email:Smtp:Enabled", false))
            throw new InvalidOperationException("SMTP email is disabled.");

        var host = configuration["Email:Smtp:Host"];
        var user = configuration["Email:Smtp:Username"];
        var password = configuration["Email:Smtp:Password"];
        var sender = configuration["Email:Smtp:FromAddress"];
        int port = configuration.GetValue("Email:Smtp:Port", 587);
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) ||
            string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(sender) ||
            port is < 1 or > 65535)
            throw new InvalidOperationException("Complete SMTP host, sender, credentials and port are required.");
        if (string.IsNullOrWhiteSpace(message.Subject) || message.Subject.Length > 200 ||
            message.Subject.IndexOfAny(['\r', '\n']) >= 0 ||
            string.IsNullOrWhiteSpace(message.PlainTextBody) || message.PlainTextBody.Length > 20000)
            throw new ArgumentException("Invalid email subject or body.", nameof(message));

        // MailAddress parses the recipient and prevents arbitrary header injection.
        var from = ParseAddress(sender, nameof(sender));
        var to = ParseAddress(message.To, nameof(message.To));
        using var mail = new MailMessage(from, to)
        {
            Subject = message.Subject,
            Body = message.PlainTextBody,
            IsBodyHtml = false
        };
        using var client = new SmtpClient(host, port)
        {
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(user, password),
            EnableSsl = true // Requires STARTTLS; fail if TLS is unavailable.
        };
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        await client.SendMailAsync(mail, timeout.Token).ConfigureAwait(false);
        return new EmailSubmission("AcceptedBySmtp");
    }

    private static MailAddress ParseAddress(string address, string name)
    {
        if (string.IsNullOrWhiteSpace(address) || address.Length > 254 ||
            address.IndexOfAny(['\r', '\n']) >= 0)
            throw new ArgumentException("Invalid email address.", name);
        try
        {
            var parsed = new MailAddress(address);
            if (!string.Equals(parsed.Address, address.Trim(), StringComparison.OrdinalIgnoreCase))
                throw new FormatException("Display names are not allowed in this field.");
            return parsed;
        }
        catch (FormatException)
        {
            throw new ArgumentException("Invalid email address.", name);
        }
    }
}
