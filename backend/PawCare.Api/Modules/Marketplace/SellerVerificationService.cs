using System.Security.Claims;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Marketplace;
public sealed class SellerVerificationService(IOwnershipGuards guards)
{
    /// <summary>Grant is read live from USER_CAPABILITIES on every seller-only operation.</summary>
    public Task RequireApprovedSeller(ClaimsPrincipal user,CancellationToken ct)=>
        guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.ApprovedSeller,ct);
}
