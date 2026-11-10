using System.Net;

namespace PawCare.Api.Infrastructure.Payments;

/// <summary>
/// Provider-neutral contract. No payment credentials, card numbers or unverified
/// payment statuses may be stored in the API. Only a real, approved payment
/// provider adapter may implement charging and signed-webhook verification.
/// </summary>
public interface IPaymentGateway
{
    Task<PaymentCheckoutSession> CreateCheckoutAsync(
        PaymentCheckoutRequest request, CancellationToken cancellationToken = default);

    Task<VerifiedPaymentEvent> VerifyWebhookAsync(
        ReadOnlyMemory<byte> rawBody,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken cancellationToken = default);
}

/// <summary>Amounts use currency minor units (e.g., 1500 = BDT 15.00).</summary>
public sealed record PaymentCheckoutRequest(
    long OrderId,
    long AmountMinor,
    string Currency,
    string IdempotencyKey,
    Uri ReturnUrl,
    Uri CancelUrl);

/// <summary>A redirect is a checkout opportunity, NOT proof of payment.</summary>
public sealed record PaymentCheckoutSession(
    string Provider,
    string ProviderSessionId,
    Uri CheckoutUrl,
    DateTimeOffset ExpiresAtUtc);

public enum PaymentEventKind
{
    Authorized,
    Captured,
    Failed,
    Refunded,
    Chargeback
}

/// <summary>
/// Only an adapter that has verified a provider webhook signature should create
/// this result. The order service must also check amount, currency, order ID,
/// merchant account, and event deduplication inside an Oracle transaction.
/// </summary>
public sealed record VerifiedPaymentEvent(
    string Provider,
    string EventId,
    string ProviderPaymentId,
    long OrderId,
    long AmountMinor,
    string Currency,
    PaymentEventKind Kind,
    DateTimeOffset OccurredAtUtc);

/// <summary>
/// Safe default for PawCare: there is no selected/approved payment processor yet.
/// Neither a checkout nor a payment event can succeed without real integration.
/// Do not replace this with fake "PAID" responses for development.
/// </summary>
public sealed class PaymentGateway : IPaymentGateway
{
    public Task<PaymentCheckoutSession> CreateCheckoutAsync(
        PaymentCheckoutRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();
        throw new PaymentGatewayUnavailableException();
    }

    public Task<VerifiedPaymentEvent> VerifyWebhookAsync(
        ReadOnlyMemory<byte> rawBody,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(headers);
        cancellationToken.ThrowIfCancellationRequested();
        throw new PaymentGatewayUnavailableException();
    }
}

public sealed class PaymentGatewayUnavailableException : Exception
{
    public PaymentGatewayUnavailableException()
        : base("Payments are unavailable until a verified payment provider is configured.")
    {
    }
}
