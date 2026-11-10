using System.Security.Claims;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Cart;
public sealed record CartItemSet(long ProductId,int Quantity);
public sealed class CartService(CartRepository repo)
{
    public Task<List<Dictionary<string,object?>>> List(ClaimsPrincipal user,CancellationToken ct)=>repo.Items(ModuleRules.UserId(user),ct);
    public async Task<object> Set(ClaimsPrincipal user,CartItemSet r,CancellationToken ct)
    {
        ModuleRules.Positive(r.ProductId,"productId");
        ModuleRules.Check(r.Quantity is >=0 and <=999,"quantity");
        await repo.SetItem(ModuleRules.UserId(user),r.ProductId,r.Quantity,ct);
        return new { productId=r.ProductId,quantity=r.Quantity };
    }
}
