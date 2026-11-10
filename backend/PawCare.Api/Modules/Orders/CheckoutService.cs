using System.Security.Claims;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Orders;
public sealed record CheckoutRequest(long ShippingAddressId);
public sealed class CheckoutService(OrderRepository repo)
{
    public Task<List<Dictionary<string,object?>>> Orders(ClaimsPrincipal user,CancellationToken ct)=>
        repo.List(ModuleRules.UserId(user),ct);
    public async Task<object> Order(ClaimsPrincipal user,long id,CancellationToken ct)=>
        await repo.Get(ModuleRules.UserId(user),id,ct)??throw new DomainException(DomainErrors.NotFound());
    public async Task<object> Checkout(ClaimsPrincipal user,CheckoutRequest r,string idempotencyKey,CancellationToken ct)
    {
        ModuleRules.Positive(r.ShippingAddressId,"shippingAddressId");
        ModuleRules.Check(idempotencyKey.Length is >=12 and <=160 && idempotencyKey.All(c=>char.IsLetterOrDigit(c)||c=='-'||c=='_'),
            "Idempotency-Key","Supply a stable, unique Idempotency-Key header.");
        try { return await repo.Checkout(ModuleRules.UserId(user),r.ShippingAddressId,idempotencyKey,ct); }
        catch(OracleException e) when(e.Number==1)
        { throw new DomainException(DomainErrors.Conflict("CHECKOUT_IN_PROGRESS","Checkout is already being processed; retry with the same key.")); }
    }
    public async Task Cancel(ClaimsPrincipal user,long id,CancellationToken ct)=>
        ModuleRules.Conflict(await repo.Cancel(ModuleRules.UserId(user),id,ct)==1);
}
