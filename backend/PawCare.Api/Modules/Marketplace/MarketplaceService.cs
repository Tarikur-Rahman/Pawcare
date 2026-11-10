using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Marketplace;
public sealed record SaleDraft(long PetId,string Title,string Description,string GeneralArea,long AskingMinor,string Currency,long WelfareEvidenceFileId);
public sealed record SaleInquiry(long ListingId,string Message);
public sealed class MarketplaceService(MarketplaceRepository repo,SellerVerificationService verification)
{
    public Task<List<Dictionary<string,object?>>> Public(CancellationToken ct)=>repo.Public(ct);
    public Task<Dictionary<string,object?>?> Detail(long id,CancellationToken ct)=>repo.Detail(id,ct);
    public async Task<object> Draft(ClaimsPrincipal user,SaleDraft r,CancellationToken ct)
    {
        await verification.RequireApprovedSeller(user,ct);
        ModuleRules.Check(r.AskingMinor>0,"askingMinor");
        ModuleRules.Positive(r.PetId,"petId");ModuleRules.Positive(r.WelfareEvidenceFileId,"welfareEvidenceFileId");
        var currency=ModuleRules.Text(r.Currency,3,"currency").ToUpperInvariant();
        ModuleRules.Check(currency.Length==3 && currency.All(c=>c is >= 'A' and <= 'Z'),"currency");
        var id=await repo.Draft(ModuleRules.UserId(user),r.PetId,ModuleRules.Text(r.Title,180,"title"),
            ModuleRules.Text(r.Description,4000,"description",20),ModuleRules.Text(r.GeneralArea,160,"generalArea"),
            r.AskingMinor,currency,r.WelfareEvidenceFileId,ct);
        return new { id,status="DRAFT" };
    }
    public async Task Submit(ClaimsPrincipal user,long id,CancellationToken ct)
    {
        await verification.RequireApprovedSeller(user,ct);
        ModuleRules.Conflict(await repo.Submit(ModuleRules.UserId(user),id,ct)==1,
            "Only your own draft listing may be submitted.");
    }
    public async Task<object> Inquire(ClaimsPrincipal user,SaleInquiry r,CancellationToken ct)=>
        new { id=await repo.Inquire(ModuleRules.UserId(user),r.ListingId,
            ModuleRules.Text(r.Message,2000,"message",5),ct),status="OPEN" };
    public Task<List<Dictionary<string,object?>>> Inquiries(ClaimsPrincipal user,CancellationToken ct)=>
        repo.MyInquiries(ModuleRules.UserId(user),ct);
    public static DomainError SalesDisabled()=>new("PET_SALES_UNAVAILABLE",
        "Final pet sales require an approved, jurisdiction-specific welfare and transfer process.",503);
}
