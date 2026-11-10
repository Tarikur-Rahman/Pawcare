using System.Security.Claims;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.LostFound;
public sealed record LostPostCreate(string Category,string Species,string Description,string GeneralArea,DateTimeOffset ObservedAt);
public sealed record SightingCreate(string ApproximateArea,DateTimeOffset ObservedAt,string Description);
public sealed record ReunionClaimCreate(long ProofAssetId);
public sealed class LostFoundService(LostFoundRepository repo)
{
    public Task<List<Dictionary<string,object?>>> Public(CancellationToken ct)=>repo.Public(ct);
    public Task<Dictionary<string,object?>?> Detail(long id,CancellationToken ct)=>repo.Detail(id,ct);
    public async Task<object> Draft(ClaimsPrincipal user,LostPostCreate r,CancellationToken ct)
    {
        var kind=ModuleRules.Text(r.Category,5,"category").ToUpperInvariant();
        ModuleRules.Check(kind is "LOST" or "FOUND","category");
        ModuleRules.Check(r.ObservedAt<=DateTimeOffset.UtcNow.AddMinutes(10),"observedAt");
        var id=await repo.Draft(ModuleRules.UserId(user),kind,ModuleRules.Text(r.Species,80,"species"),
            ModuleRules.Text(r.Description,4000,"description",10),ModuleRules.Text(r.GeneralArea,160,"generalArea"),r.ObservedAt,ct);
        return new { id,status="DRAFT" };
    }
    public async Task<object> Sighting(ClaimsPrincipal user,long post,SightingCreate r,CancellationToken ct)
    {
        ModuleRules.Check(r.ObservedAt<=DateTimeOffset.UtcNow.AddMinutes(10),"observedAt");
        var id=await repo.Sighting(ModuleRules.UserId(user),post,ModuleRules.Text(r.ApproximateArea,160,"approximateArea"),
            r.ObservedAt,ModuleRules.Text(r.Description,2000,"description"),ct);
        return new { id,status="SUBMITTED" };
    }
    public Task<List<Dictionary<string,object?>>> Sightings(ClaimsPrincipal user,long post,CancellationToken ct)=>
        repo.Sightings(ModuleRules.UserId(user),post,ct);
    public async Task<object> ConfirmReunion(ClaimsPrincipal user,long post,long claim,CancellationToken ct)
    {
        var actor=ModuleRules.UserId(user);
        var db=repo.Db;
        return await db.Transaction<object>(async(c,t)=>{
            var row=await db.One(@"SELECT cl.claim_id,cl.claimant_id,cl.status,
                    cl.poster_confirmed_at,cl.claimant_confirmed_at,p.poster_id
                FROM REUNIFICATION_CLAIMS cl JOIN LOST_FOUND_POSTS p ON p.post_id=cl.post_id
                WHERE cl.claim_id=:claim AND cl.post_id=:post FOR UPDATE OF cl.status",
                ModuleRules.P(("claim",claim),("post",post)),ct,c,t);
            ModuleRules.Found(row is not null);
            ModuleRules.Conflict(ModuleRules.Str(row!,"STATUS")=="VERIFIED","Claim requires moderator verification.");
            var poster=ModuleRules.Id(row,"POSTER_ID");var claimant=ModuleRules.Id(row,"CLAIMANT_ID");
            ModuleRules.Found(actor==poster || actor==claimant);
            var column=actor==poster?"poster_confirmed_at":"claimant_confirmed_at";
            await db.Execute($"UPDATE REUNIFICATION_CLAIMS SET {column}=COALESCE({column},SYSTIMESTAMP) WHERE claim_id=:id",
                ModuleRules.P(("id",claim)),ct,c,t);
            var current=await db.One(@"SELECT poster_confirmed_at,claimant_confirmed_at
                FROM REUNIFICATION_CLAIMS WHERE claim_id=:id",ModuleRules.P(("id",claim)),ct,c,t);
            if(current!["POSTER_CONFIRMED_AT"] is null || current["CLAIMANT_CONFIRMED_AT"] is null)
                return new { status="AWAITING_OTHER_PARTY" };
            await db.Execute(@"UPDATE REUNIFICATION_CLAIMS SET status='REUNITED',resolved_at=SYSTIMESTAMP
                WHERE claim_id=:id AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL",
                ModuleRules.P(("id",claim)),ct,c,t);
            await db.Execute("UPDATE LOST_FOUND_POSTS SET status='REUNITED',updated_at=SYSTIMESTAMP WHERE post_id=:id",
                ModuleRules.P(("id",post)),ct,c,t);
            await db.Execute(@"INSERT INTO AUDIT_EVENTS(actor_user_id,action,entity_type,entity_id,reason_code)
                VALUES (:actor,'PET_REUNITED','LOST_FOUND',:id,'DUAL_CONFIRMED')",
                ModuleRules.P(("actor",actor),("id",post.ToString())),ct,c,t);
            return new { status="REUNITED" };
        },ct);
    }
    public async Task<object> Claim(ClaimsPrincipal user,long post,ReunionClaimCreate r,CancellationToken ct)
    { var id=await repo.Claim(ModuleRules.UserId(user),post,ModuleRules.Positive(r.ProofAssetId,"proofAssetId"),ct);
      return new { id,status="SUBMITTED" }; }
}
