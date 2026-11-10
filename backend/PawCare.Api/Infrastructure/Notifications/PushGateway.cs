using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace PawCare.Api.Infrastructure.Notifications;

/// <summary>
/// Expo tickets mean accepted for processing, not delivered to the phone.
/// The caller must persist ticket IDs and check receipts asynchronously.
/// </summary>
public interface IPushGateway
{
    Task<PushSubmission> SendAsync(
        PushMessage message, CancellationToken cancellationToken = default);
    Task<PushReceipt> GetReceiptAsync(
        string ticketId, CancellationToken cancellationToken = default);
}

public sealed record PushMessage(
    string ExpoPushToken,
    string Title,
    string Body,
    IReadOnlyDictionary<string, string>? Data = null);

public enum PushSubmissionStatus { AcceptedByExpo, RejectedByExpo }
public sealed record PushSubmission(PushSubmissionStatus Status, string? TicketId, string? ErrorCode);

/// <summary>
/// Receipt status 'ok' means delivered to FCM/APNs; it does not guarantee that
/// the user opened or viewed the notification.
/// </summary>
public sealed record PushReceipt(string TicketId, bool AcceptedByDeviceProvider, string? ErrorCode);

/// <summary>
/// Implements Expo Push HTTP API for Expo-compatible mobile push tokens.
/// Disabled by default (Push:Expo:Enabled=false). Requires expo-notifications
/// and valid native notification credentials in the mobile build.
/// </summary>
public sealed class ExpoPushGateway(HttpClient httpClient, IConfiguration configuration) : IPushGateway
{
    private static readonly Uri SendUri = new("https://exp.host/--/api/v2/push/send");
    private static readonly Uri ReceiptsUri = new("https://exp.host/--/api/v2/push/getReceipts");

    public async Task<PushSubmission> SendAsync(
        PushMessage message, CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        ArgumentNullException.ThrowIfNull(message);
        if (!IsExpoToken(message.ExpoPushToken))
            throw new ArgumentException("A valid Expo push token is required.", nameof(message));
        RequireText(message.Title, 1, 100, nameof(message.Title));
        RequireText(message.Body, 1, 2000, nameof(message.Body));
        if (message.Data is { Count: > 16 } ||
            (message.Data?.Any(pair => pair.Key.Length is < 1 or > 50 || pair.Value.Length > 500) ?? false))
            throw new ArgumentException("Push metadata is too large.", nameof(message));

        var payload = new
        {
            to = message.ExpoPushToken,
            title = message.Title,
            body = message.Body,
            sound = "default",
            data = message.Data
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, SendUri)
        {
            Content = JsonContent.Create(payload)
        };
        AddAuth(request);
        using var response = await httpClient.SendAsync(request,
            HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        using var document = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false),
            cancellationToken: cancellationToken).ConfigureAwait(false);

        // A single push may return an object; batched responses return an array.
        var root = document.RootElement;
        if (!root.TryGetProperty("data", out var result))
            throw new InvalidDataException("Expo returned no push ticket.");
        if (result.ValueKind == JsonValueKind.Array)
        {
            if (result.GetArrayLength() != 1)
                throw new InvalidDataException("Unexpected Expo push ticket count.");
            result = result[0];
        }
        if (result.ValueKind != JsonValueKind.Object)
            throw new InvalidDataException("Invalid Expo push ticket format.");

        var status = GetString(result, "status");
        if (status == "ok")
        {
            var id = GetString(result, "id");
            if (string.IsNullOrWhiteSpace(id))
                throw new InvalidDataException("Expo accepted a push without a receipt ticket ID.");
            return new PushSubmission(PushSubmissionStatus.AcceptedByExpo, id, null);
        }
        if (status == "error")
            return new PushSubmission(PushSubmissionStatus.RejectedByExpo, null, ReadExpoErrorCode(result));
        throw new InvalidDataException("Unknown Expo push ticket status.");
    }

    public async Task<PushReceipt> GetReceiptAsync(
        string ticketId, CancellationToken cancellationToken = default)
    {
        EnsureEnabled();
        if (string.IsNullOrWhiteSpace(ticketId) || ticketId.Length > 128 ||
            ticketId.Any(char.IsControl))
            throw new ArgumentException("Invalid push ticket ID.", nameof(ticketId));

        using var request = new HttpRequestMessage(HttpMethod.Post, ReceiptsUri)
        {
            Content = JsonContent.Create(new { ids = new[] { ticketId } })
        };
        AddAuth(request);
        using var response = await httpClient.SendAsync(request,
            HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        using var document = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false),
            cancellationToken: cancellationToken).ConfigureAwait(false);

        var root = document.RootElement;
        if (!root.TryGetProperty("data", out var receipts) ||
            receipts.ValueKind != JsonValueKind.Object ||
            !receipts.TryGetProperty(ticketId, out var receipt))
            throw new InvalidOperationException("Push receipt not yet available; retry later.");
        var status = GetString(receipt, "status");
        return status switch
        {
            "ok" => new PushReceipt(ticketId, true, null),
            "error" => new PushReceipt(ticketId, false, ReadExpoErrorCode(receipt)),
            _ => throw new InvalidDataException("Unknown Expo push receipt status.")
        };
    }

    private void EnsureEnabled()
    {
        if (!configuration.GetValue("Push:Expo:Enabled", false))
            throw new InvalidOperationException("Expo push gateway is disabled.");
    }

    private void AddAuth(HttpRequestMessage request)
    {
        var accessToken = configuration["Push:Expo:AccessToken"];
        if (!string.IsNullOrWhiteSpace(accessToken))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    private static string? GetString(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object &&
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() : null;

    private static string? ReadExpoErrorCode(JsonElement element) =>
        element.TryGetProperty("details", out var details) ? GetString(details, "error") : null;

    private static bool IsExpoToken(string? token) =>
        token is { Length: >= 25 and <= 240 } &&
        (token.StartsWith("ExpoPushToken[", StringComparison.Ordinal) ||
         token.StartsWith("ExponentPushToken[", StringComparison.Ordinal)) &&
        token.EndsWith(']') &&
        token.All(c => !char.IsControl(c) && !char.IsWhiteSpace(c));

    private static void RequireText(string? value, int min, int max, string name)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length < min || value.Length > max)
            throw new ArgumentException($"{name} must have {min}-{max} characters.", name);
    }
}
