using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Adoption;
/// <summary>Both parties must confirm while the same handover row is locked.</summary>
public sealed class HandoverService(AdoptionRepository repository)
{
    public async Task<object> Confirm(ClaimsPrincipal user,long adoption,string key,CancellationToken ct)
    {
        var actor=ModuleRules.UserId(user);
        ModuleRules.Check(key.Length is >= 12 and <= 160,"idempotencyKey");
        var db=repository.Db;
        return await db.Transaction<object>(async (c,t)=>{
            var row=await db.One(@"SELECT h.handover_id,h.pet_id,h.prior_owner_id,h.new_owner_id,
                h.owner_confirmed_at,h.adopter_confirmed_at,h.confirmed_at
                FROM ADOPTION_HANDOVERS h WHERE h.adoption_id=:id FOR UPDATE",
                ModuleRules.P(("id",adoption)),ct,c,t);
            ModuleRules.Found(row is not null);
            var owner=ModuleRules.Id(row!,"PRIOR_OWNER_ID");
            var adopter=ModuleRules.Id(row,"NEW_OWNER_ID");
            ModuleRules.Found(actor==owner || actor==adopter);
            if(row["CONFIRMED_AT"] is not null) return new { status="COMPLETED" };
            var column=actor==owner ? "owner_confirmed_at" : "adopter_confirmed_at"; // server-controlled allowlist
            await db.Execute($"UPDATE ADOPTION_HANDOVERS SET {column}=SYSTIMESTAMP WHERE handover_id=:id AND {column} IS NULL",
                ModuleRules.P(("id",ModuleRules.Id(row,"HANDOVER_ID"))),ct,c,t);
            var latest=await db.One(@"SELECT owner_confirmed_at,adopter_confirmed_at FROM ADOPTION_HANDOVERS
                WHERE handover_id=:id",ModuleRules.P(("id",ModuleRules.Id(row,"HANDOVER_ID"))),ct,c,t);
            if(latest!["OWNER_CONFIRMED_AT"] is null || latest["ADOPTER_CONFIRMED_AT"] is null)
                return new { status="AWAITING_OTHER_PARTY" };
            var updated=await db.Execute(@"UPDATE PETS SET owner_user_id=:adopter,updated_at=SYSTIMESTAMP
                WHERE pet_id=:pet AND owner_user_id=:owner AND status='ACTIVE'",
                ModuleRules.P(("adopter",adopter),("pet",ModuleRules.Id(row,"PET_ID")),("owner",owner)),ct,c,t);
            ModuleRules.Conflict(updated==1,"Pet ownership changed; handover requires review.");
            await db.Execute(@"UPDATE ADOPTION_HANDOVERS SET confirmed_at=SYSTIMESTAMP
                WHERE handover_id=:id",ModuleRules.P(("id",ModuleRules.Id(row,"HANDOVER_ID"))),ct,c,t);
            await db.Execute("UPDATE ADOPTION_LISTINGS SET status='COMPLETED' WHERE adoption_id=:id",
                ModuleRules.P(("id",adoption)),ct,c,t);
            await db.Execute("DELETE FROM PET_LISTING_LOCKS WHERE pet_id=:pet AND listing_type='ADOPTION' AND listing_id=:adoption",
                ModuleRules.P(("pet",ModuleRules.Id(row,"PET_ID")),("adoption",adoption)),ct,c,t);
            await db.Execute(@"INSERT INTO AUDIT_EVENTS(actor_user_id,action,entity_type,entity_id,reason_code)
                VALUES (:actor,'ADOPTION_TRANSFER','PET',:pet,'DUAL_CONFIRMED')",
                ModuleRules.P(("actor",actor),("pet",ModuleRules.Id(row,"PET_ID").ToString())),ct,c,t);
            return new { status="COMPLETED" };
        },ct);
    }
}
