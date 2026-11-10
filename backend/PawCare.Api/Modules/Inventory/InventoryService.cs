using System.Security.Claims;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Inventory;
public sealed record InventoryAdjustment(long ProductId,long QuantityDelta,string Reason);
public sealed class InventoryService(InventoryRepository repo,IOwnershipGuards guards)
{
    public async Task<object> List(ClaimsPrincipal user,CancellationToken ct)
    { await guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.StoreOperator,ct);return await repo.List(ct); }
    public async Task<object> Adjust(ClaimsPrincipal user,InventoryAdjustment request,CancellationToken ct)
    {
        await guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.StoreOperator,ct);
        ModuleRules.Positive(request.ProductId,"productId");
        ModuleRules.Check(request.QuantityDelta is >=-1_000_000 and <=1_000_000 && request.QuantityDelta!=0,"quantityDelta");
        var reason=ModuleRules.Text(request.Reason,20,"reason").ToUpperInvariant();
        ModuleRules.Check(reason is "RESTOCK" or "ADJUSTMENT" or "RETURN" or "WRITE_OFF","reason");
        return await repo.Adjust(ModuleRules.UserId(user),request.ProductId,request.QuantityDelta,reason,ct);
    }
}
