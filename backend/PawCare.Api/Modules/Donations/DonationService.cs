using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Donations;
public sealed record DonationCampaignCreate(string Title,string Purpose,long GoalMinor,string Currency);
public sealed class DonationService(DonationRepository repo,IOwnershipGuards guards)
{
    public Task<object> Public(CancellationToken ct)=>PublicInternal(ct);
    private async Task<object> PublicInternal(CancellationToken ct)=>await repo.Public(ct);
    public async Task<object> Draft(ClaimsPrincipal user,DonationCampaignCreate r,CancellationToken ct)
    {
        await guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.VerifiedBeneficiary,ct);
        ModuleRules.Check(r.GoalMinor is >0 and <=100_000_000_000L,"goalMinor");
        var currency=ModuleRules.Text(r.Currency,3,"currency").ToUpperInvariant();
        ModuleRules.Check(currency.Length==3 && currency.All(c=>c is >= 'A' and <= 'Z'),"currency");
        var id=await repo.Draft(ModuleRules.UserId(user),ModuleRules.Text(r.Title,180,"title"),
            ModuleRules.Text(r.Purpose,4000,"purpose",20),r.GoalMinor,currency,ct);
        return new { id,status="DRAFT" };
    }
    public async Task Submit(ClaimsPrincipal user,long campaign,CancellationToken ct)
    {
        await guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.VerifiedBeneficiary,ct);
        ModuleRules.Conflict(await repo.Submit(ModuleRules.UserId(user),campaign,ct)==1,
            "Only your own draft campaign may be submitted for review.");
    }
    public static DomainError PaymentsUnavailable()=>new("DONATIONS_DISABLED",
        "Monetary donations are disabled until an approved payment provider and legal controls are configured.",503);
}
