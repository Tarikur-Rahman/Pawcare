using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Admin;
public sealed record AdminActivateRequest(bool IdentityReviewed,string ReasonCode);
public sealed record CapabilityGrantRequest(string Capability,long EvidenceFileId,string ReasonCode);
public sealed record AdminVerifyClaim(string ReasonCode);
public sealed record CapabilityRevokeRequest(string ReasonCode);
public sealed class AdminService(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Users(CancellationToken ct)=>db.Query(@"
        SELECT user_id AS ""id"",email,role,status,created_at AS ""createdAt"" FROM USERS
        ORDER BY user_id DESC FETCH FIRST 100 ROWS ONLY",null,ct);
    public async Task<object> Activate(ClaimsPrincipal principal,long userId,AdminActivateRequest request,CancellationToken ct)
    {
        ModuleRules.Check(request.IdentityReviewed,"identityReviewed",
            "Manual verification must be completed before activation.");
        var admin=ModuleRules.UserId(principal);
        ModuleRules.Positive(userId,"userId");
        var reason=ModuleRules.Text(request.ReasonCode,80,"reasonCode");
        return await db.Transaction<object>(async(c,t)=>{
            var current=await db.One(@"SELECT status FROM USERS
                WHERE user_id=:id AND role='OWNER' FOR UPDATE",ModuleRules.P(("id",userId)),ct,c,t);
            ModuleRules.Found(current is not null);
            ModuleRules.Conflict(ModuleRules.Str(current!,"STATUS")=="PENDING_VERIFICATION");
            await db.Execute(@"UPDATE USERS SET status='ACTIVE',email_verified_at=SYSTIMESTAMP,
                updated_at=SYSTIMESTAMP WHERE user_id=:id",ModuleRules.P(("id",userId)),ct,c,t);
            await db.Execute(@"INSERT INTO AUDIT_EVENTS(actor_user_id,action,entity_type,entity_id,reason_code)
                VALUES (:actor,'ADMIN_ACTIVATE','USER',:target,:reason)",
                ModuleRules.P(("actor",admin),("target",userId.ToString()),("reason",reason)),ct,c,t);
            return new { id=userId,status="ACTIVE" };
        },ct);
    }
    public async Task<object> VerifyReunionClaim(ClaimsPrincipal principal,long claimId,string reasonCode,CancellationToken ct)
    {
        var actor=ModuleRules.UserId(principal);
        var reason=ModuleRules.Text(reasonCode,80,"reasonCode");
        return await db.Transaction<object>(async(c,t)=>{
            var claim=await db.One(@"SELECT cl.status FROM REUNIFICATION_CLAIMS cl
                JOIN FILE_ASSETS f ON f.file_id=cl.proof_asset_id AND f.scan_status='SAFE'
                WHERE cl.claim_id=:id FOR UPDATE OF cl.status",
                ModuleRules.P(("id",claimId)),ct,c,t);
            ModuleRules.Found(claim is not null);
            ModuleRules.Conflict(ModuleRules.Str(claim!,"STATUS")=="SUBMITTED");
            await db.Execute(@"UPDATE REUNIFICATION_CLAIMS SET status='VERIFIED',
                reviewed_by_user_id=:admin,reviewed_at=SYSTIMESTAMP WHERE claim_id=:id",
                ModuleRules.P(("admin",actor),("id",claimId)),ct,c,t);
            await db.Execute(@"INSERT INTO AUDIT_EVENTS(actor_user_id,action,entity_type,entity_id,reason_code)
                VALUES (:actor,'REUNION_CLAIM_VERIFIED','LOST_FOUND',:id,:reason)",
                ModuleRules.P(("actor",actor),("id",claimId.ToString()),("reason",reason)),ct,c,t);
            return new { id=claimId,status="VERIFIED" };
        },ct);
    }
    public async Task<object> Grant(ClaimsPrincipal principal,long userId,CapabilityGrantRequest request,CancellationToken ct)
    {
        var admin=ModuleRules.UserId(principal);
        var capability=ModuleRules.Text(request.Capability,32,"capability").ToUpperInvariant();
        ModuleRules.Check(capability is "APPROVED_SELLER" or "STORE_OPERATOR" or "VERIFIED_BENEFICIARY","capability");
        ModuleRules.Positive(request.EvidenceFileId,"evidenceFileId");
        var reason=ModuleRules.Text(request.ReasonCode,80,"reasonCode");
        return await db.Transaction<object>(async(c,t)=>{
            var target=await db.One("SELECT user_id FROM USERS WHERE user_id=:id AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("id",userId)),ct,c,t);
            ModuleRules.Found(target is not null);
            var evidence=await db.One(@"SELECT file_id FROM FILE_ASSETS WHERE file_id=:id AND owner_user_id=:user_id
                AND scan_status='SAFE' AND deleted_at IS NULL AND access_policy='REVIEWER_ONLY'",
                ModuleRules.P(("id",request.EvidenceFileId),("user_id",userId)),ct,c,t);
            ModuleRules.Conflict(evidence is not null,"Verified, approved evidence is required before granting a capability.");
            var id=await db.InsertId(@"INSERT INTO USER_CAPABILITIES(user_id,capability,granted_by_user_id,reason_code)
                VALUES (:user_id,:capability,:admin,:reason)",
                ModuleRules.P(("user_id",userId),("capability",capability),
                  ("admin",admin),("reason",reason)),"capability_id",ct,c,t);
            await db.Execute(@"INSERT INTO AUDIT_EVENTS(actor_user_id,action,entity_type,entity_id,reason_code)
                VALUES (:actor,'CAPABILITY_GRANT','USER',:target,:reason)",
                ModuleRules.P(("actor",admin),("target",userId.ToString()),("reason",reason)),ct,c,t);
            return new { id,capability,status="ACTIVE" };
        },ct);
    }

    public async Task<object> Revoke(ClaimsPrincipal principal,long capabilityId,string reasonCode,CancellationToken ct)
    {
        var actor=ModuleRules.UserId(principal);
        ModuleRules.Positive(capabilityId,"capabilityId");
        var reason=ModuleRules.Text(reasonCode,80,"reasonCode");
        return await db.Transaction<object>(async(c,t)=>{
            var changed=await db.Execute(@"UPDATE USER_CAPABILITIES
                SET status='REVOKED',revoked_at=SYSTIMESTAMP
                WHERE capability_id=:id AND status='ACTIVE'",
                ModuleRules.P(("id",capabilityId)),ct,c,t);
            ModuleRules.Found(changed==1);
            await db.Execute(@"INSERT INTO AUDIT_EVENTS(actor_user_id,action,entity_type,entity_id,reason_code)
                VALUES (:actor,'CAPABILITY_REVOKE','USER_CAPABILITY',:id,:reason)",
                ModuleRules.P(("actor",actor),("id",capabilityId.ToString()),("reason",reason)),ct,c,t);
            return new { id=capabilityId,status="REVOKED" };
        },ct);
    }
}
