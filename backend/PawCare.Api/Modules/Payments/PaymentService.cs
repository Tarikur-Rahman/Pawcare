using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Infrastructure.Payments;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Payments;
public sealed record StartPaymentRequest(long OrderId,Uri ReturnUrl,Uri CancelUrl,string IdempotencyKey);
public sealed class PaymentService(ModuleDb db,IPaymentGateway gateway,WebhookVerifier verifier)
{
    public async Task<object> Start(ClaimsPrincipal user,StartPaymentRequest r,CancellationToken ct)
    {
        var actor=ModuleRules.UserId(user);
        var order=await db.One(@"SELECT order_id,total_minor,currency,status FROM ORDERS
             WHERE order_id=:id AND user_id=:user_id",ModuleRules.P(("id",r.OrderId),("user_id",actor)),ct);
        ModuleRules.Found(order is not null);
        ModuleRules.Conflict(ModuleRules.Str(order!,"STATUS")=="PLACED","This order cannot start a payment.");
        ModuleRules.Check(!string.IsNullOrWhiteSpace(r.IdempotencyKey) && r.IdempotencyKey.Length is >=12 and <=160,"idempotencyKey");
        ModuleRules.Check(r.ReturnUrl.IsAbsoluteUri && r.CancelUrl.IsAbsoluteUri &&
           r.ReturnUrl.Scheme==Uri.UriSchemeHttps && r.CancelUrl.Scheme==Uri.UriSchemeHttps,"returnUrl");
        try
        {
            var result=await gateway.CreateCheckoutAsync(new PaymentCheckoutRequest(r.OrderId,
                ModuleRules.Id(order,"TOTAL_MINOR"),ModuleRules.Str(order,"CURRENCY"),r.IdempotencyKey,
                r.ReturnUrl,r.CancelUrl),ct);
            return new { provider=result.Provider,checkoutUrl=result.CheckoutUrl,
                expiresAtUtc=result.ExpiresAtUtc,status="CHECKOUT_STARTED_NOT_PAID" };
        }
        catch(PaymentGatewayUnavailableException) { throw new DomainException(DomainErrors.ServiceUnavailable()); }
    }
    public async Task<object> Receive(string routeProvider,byte[] raw,IReadOnlyDictionary<string,string> headers,CancellationToken ct)
    {
        var verified=await verifier.Verify(routeProvider,raw,headers,ct);
        // Refunds and disputes require a separate audited workflow; never mark them as normal failed payments.
        if (verified.Kind is PaymentEventKind.Refunded or PaymentEventKind.Chargeback)
            throw new DomainException(DomainErrors.ServiceUnavailable());
        var hash=ModuleRules.Hash(Convert.ToBase64String(raw));
        return await db.Transaction<object>(async (c,t)=>{
            var eventRow=await db.One(@"SELECT event_payload_sha256,outcome FROM PAYMENT_EVENTS
               WHERE provider_code=:provider AND provider_event_id=:event_id FOR UPDATE",
               ModuleRules.P(("provider",verified.Provider),("event_id",verified.EventId)),ct,c,t);
            if(eventRow is not null)
            {
                ModuleRules.Conflict(ModuleRules.Str(eventRow,"EVENT_PAYLOAD_SHA256")==hash,
                    "Webhook replay content does not match the original event.");
                return new { accepted=true,duplicate=true };
            }
            var order=await db.One("SELECT total_minor,currency,status FROM ORDERS WHERE order_id=:id FOR UPDATE",
                ModuleRules.P(("id",verified.OrderId)),ct,c,t);
            ModuleRules.Found(order is not null);
            ModuleRules.Conflict(ModuleRules.Id(order!,"TOTAL_MINOR")==verified.AmountMinor &&
                ModuleRules.Str(order,"CURRENCY")==verified.Currency,"Verified amount/currency mismatch.");
            ModuleRules.Conflict(ModuleRules.Str(order,"STATUS") is "PLACED" or "PAID",
                "Order is not payable in its current state.");
            var payment=await db.One(@"SELECT payment_id,order_id,state FROM PAYMENTS
               WHERE provider_code=:provider AND provider_ref=:ref FOR UPDATE",
               ModuleRules.P(("provider",verified.Provider),("ref",verified.ProviderPaymentId)),ct,c,t);
            var state=verified.Kind switch {
                PaymentEventKind.Authorized => "AUTHORIZED",
                PaymentEventKind.Captured => "CAPTURED",
                PaymentEventKind.Failed => "FAILED",
                _ => throw new DomainException(DomainErrors.ServiceUnavailable())
            };
            long paymentId;
            if(payment is null)
                paymentId=await db.InsertId(@"INSERT INTO PAYMENTS
                  (order_id,provider_code,provider_ref,amount_minor,currency,state)
                  VALUES (:id,:provider,:ref,:amount,:currency,:state)",
                  ModuleRules.P(("id",verified.OrderId),("provider",verified.Provider),
                    ("ref",verified.ProviderPaymentId),("amount",verified.AmountMinor),
                    ("currency",verified.Currency),("state",state)),"payment_id",ct,c,t);
            else
            {
                ModuleRules.Conflict(ModuleRules.Id(payment,"ORDER_ID")==verified.OrderId,
                    "Provider payment reference is already linked to a different order.");
                var oldState=ModuleRules.Str(payment,"STATE");
                ModuleRules.Conflict(oldState != "CAPTURED" || state == "CAPTURED",
                    "A captured payment cannot be downgraded by a later webhook.");
                ModuleRules.Conflict(oldState != "FAILED" || state == "FAILED",
                    "A failed payment cannot be reused for a different outcome.");
                paymentId=ModuleRules.Id(payment,"PAYMENT_ID");
                await db.Execute("UPDATE PAYMENTS SET state=:state,updated_at=SYSTIMESTAMP WHERE payment_id=:id",
                    ModuleRules.P(("state",state),("id",paymentId)),ct,c,t);
            }
            await db.Execute(@"INSERT INTO PAYMENT_EVENTS(payment_id,provider_code,provider_event_id,event_type,
               event_payload_sha256,outcome,processed_at) VALUES (:id,:provider,:event_id,:kind,:hash,'PROCESSED',SYSTIMESTAMP)",
               ModuleRules.P(("id",paymentId),("provider",verified.Provider),("event_id",verified.EventId),
                 ("kind",verified.Kind.ToString().ToUpperInvariant()),("hash",hash)),ct,c,t);
            if(verified.Kind==PaymentEventKind.Captured)
                await db.Execute("UPDATE ORDERS SET status='PAID',updated_at=SYSTIMESTAMP WHERE order_id=:id AND status='PLACED'",
                    ModuleRules.P(("id",verified.OrderId)),ct,c,t);
            // The store gateway is disabled until a real provider verifies signatures.
            return new { accepted=true,duplicate=false };
        },ct);
    }
}
