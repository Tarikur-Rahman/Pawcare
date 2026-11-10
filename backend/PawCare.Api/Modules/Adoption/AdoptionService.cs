using System.Security.Claims;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Adoption;
public sealed class AdoptionService(AdoptionRepository repo,IOwnershipGuards guards)
{
    public Task<List<Dictionary<string,object?>>> Public(CancellationToken ct)=>repo.Public(ct);
    public async Task<object?> Detail(long id,CancellationToken ct)=>await repo.Detail(id,ct);
    public async Task<object> Create(ClaimsPrincipal user,AdoptionCreate r,CancellationToken ct)
    {
        await guards.EnsurePetOwnerAsync(user,r.PetId,ct);
        var id=await repo.Create(ModuleRules.UserId(user),r.PetId,
            ModuleRules.Text(r.Title,180,"title"),ModuleRules.Text(r.Description,4000,"description",20),
            ModuleRules.Text(r.GeneralArea,160,"generalArea"),ct);
        return new { id,status="DRAFT" };
    }
    public async Task<object> Apply(ClaimsPrincipal user,long id,AdoptionApply r,CancellationToken ct)
    { var application=await repo.Apply(ModuleRules.UserId(user),id,ModuleRules.Text(r.Answers,4000,"answers",10),ct);
      return new { id=application,status="SUBMITTED" }; }
    public Task<List<Dictionary<string,object?>>> Applications(ClaimsPrincipal user,long id,CancellationToken ct)=>
        repo.Applications(ModuleRules.UserId(user),id,ct);
    public async Task Submit(ClaimsPrincipal user,long id,CancellationToken ct)=>
        ModuleRules.Conflict(await repo.Submit(ModuleRules.UserId(user),id,ct)==1,
            "Only your own draft can be submitted for review.");
    public async Task<object> Decide(ClaimsPrincipal user,long id,long application,AdoptionDecision r,CancellationToken ct)=>
        new { handoverId=await repo.Decide(ModuleRules.UserId(user),id,application,r.Accept,ct),
            status=r.Accept?"MATCHED":"REJECTED" };
}
