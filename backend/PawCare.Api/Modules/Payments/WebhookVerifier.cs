using PawCare.Api.Common;
using PawCare.Api.Infrastructure.Payments;
namespace PawCare.Api.Modules.Payments;
/// <summary>No unsigned webhook is ever trusted. The gateway must authenticate the provider signature.</summary>
public sealed class WebhookVerifier(IPaymentGateway gateway)
{
    public async Task<VerifiedPaymentEvent> Verify(string routeProvider,byte[] body,
        IReadOnlyDictionary<string,string> headers,CancellationToken ct)
    {
        if(body.Length is <=0 or >1_048_576) throw new DomainException(DomainErrors.ValidationFailed(
            new Dictionary<string,string[]>{{"body",["Invalid webhook size."]}}));
        VerifiedPaymentEvent result;
        try { result=await gateway.VerifyWebhookAsync(body,headers,ct); }
        catch(PaymentGatewayUnavailableException) { throw new DomainException(DomainErrors.ServiceUnavailable()); }
        if(!string.Equals(result.Provider,routeProvider,StringComparison.OrdinalIgnoreCase) ||
           string.IsNullOrWhiteSpace(result.EventId) || result.AmountMinor<=0 || result.OrderId<=0)
            throw new DomainException(DomainErrors.Forbidden());
        return result;
    }
}
