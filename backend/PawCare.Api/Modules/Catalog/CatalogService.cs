using System.Security.Claims;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Catalog;
public sealed record ProductCreate(long CategoryId,string Sku,string Title,string Species,long PriceMinor,string Currency);
public sealed class CatalogService(CatalogRepository repo,IOwnershipGuards guards)
{
    public Task<List<Dictionary<string,object?>>> Categories(CancellationToken ct)=>repo.Categories(ct);
    public Task<List<Dictionary<string,object?>>> Products(CancellationToken ct)=>repo.Products(ct);
    public Task<Dictionary<string,object?>?> Product(long id,CancellationToken ct)=>repo.Product(id,ct);
    public async Task<object> Draft(ClaimsPrincipal user,ProductCreate r,CancellationToken ct)
    {
        await guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.StoreOperator,ct);
        ModuleRules.Check(r.PriceMinor is >=0 and <=1_000_000_000_000L,"priceMinor");
        var currency=ModuleRules.Text(r.Currency,3,"currency").ToUpperInvariant();
        ModuleRules.Check(currency.Length==3 && currency.All(c=>c is >= 'A' and <= 'Z'),"currency");
        var id=await repo.Create(r.CategoryId,ModuleRules.Text(r.Sku,80,"sku"),
           ModuleRules.Text(r.Title,240,"title"),ModuleRules.Text(r.Species,80,"species"),r.PriceMinor,currency,ct);
        return new { id,status="DRAFT" };
    }
}
