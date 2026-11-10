using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Moderation;
public sealed record ReportListing(string EntityType,long EntityId,string ReasonCode,string? Details);
public sealed record ReviewDecision(string EntityType,long EntityId,bool Approve,string ReasonCode);
public sealed record FavoriteCreate(string EntityType,long EntityId);
public sealed class ModerationService(ModuleDb db)
{
    public async Task<object> Report(ClaimsPrincipal user,ReportListing r,CancellationToken ct)
    {
        var type=ModuleRules.Text(r.EntityType,20,"entityType").ToUpperInvariant();
        ModuleRules.Check(type is "ADOPTION" or "PET_SALE" or "LOST_FOUND" or "FOOD_PRODUCT" or "DONATION","entityType");
        var reason=ModuleRules.Text(r.ReasonCode,20,"reasonCode").ToUpperInvariant();
        ModuleRules.Check(reason is "FRAUD" or "ABUSE" or "ILLEGAL" or "PRIVACY" or "SPAM" or "MISLEADING" or "OTHER","reasonCode");
        ModuleRules.Positive(r.EntityId,"entityId");
        var id=await db.InsertId(@"INSERT INTO LISTING_REPORTS(reporter_id,listing_type,listing_id,reason_code,details_private)
         VALUES (:actor,:type,:id,:reason,:details)",
         ModuleRules.P(("actor",ModuleRules.UserId(user)),("type",type),("id",r.EntityId),
            ("reason",reason),("details",string.IsNullOrWhiteSpace(r.Details)?null:ModuleRules.Text(r.Details,3000,"details"))),
         "report_id",ct);
        return new { id,status="OPEN" };
    }
    public Task<List<Dictionary<string,object?>>> Favorites(ClaimsPrincipal user,CancellationToken ct)=>db.Query(@"
        SELECT favorite_id AS ""id"",entity_type AS ""entityType"",entity_id AS ""entityId""
        FROM FAVORITES WHERE user_id=:id ORDER BY created_at DESC FETCH FIRST 100 ROWS ONLY",
        ModuleRules.P(("id",ModuleRules.UserId(user))),ct);
    public async Task<object> Favorite(ClaimsPrincipal user,string rawType,long id,CancellationToken ct)
    {
        var type=ModuleRules.Text(rawType,20,"entityType").ToUpperInvariant();
        var (table,idColumn,publishColumn)=type switch
        {
            "ADOPTION"=>("ADOPTION_LISTINGS","adoption_id","PUBLISHED"),
            "PET_SALE"=>("PET_SALE_LISTINGS","sale_listing_id","ACTIVE"),
            "LOST_FOUND"=>("LOST_FOUND_POSTS","post_id","OPEN"),
            "FOOD_PRODUCT"=>("FOOD_PRODUCTS","product_id","ACTIVE"),
            _=>throw new DomainException(DomainErrors.ValidationFailed(new Dictionary<string,string[]> {
                ["entityType"]=["Unsupported favorite type."] }))
        };
        var exists=await db.Scalar($"SELECT COUNT(*) FROM {table} WHERE {idColumn}=:id AND status=:status",
            ModuleRules.P(("id",id),("status",publishColumn)),ct);
        ModuleRules.Found(Convert.ToInt64(exists)>0);
        var actor=ModuleRules.UserId(user);
        var duplicate=await db.Scalar(@"SELECT COUNT(*) FROM FAVORITES
            WHERE user_id=:actor AND entity_type=:type AND entity_id=:id",
            ModuleRules.P(("actor",actor),("type",type),("id",id)),ct);
        if(Convert.ToInt64(duplicate)>0) return new { entityType=type,entityId=id,alreadySaved=true };
        await db.Execute("INSERT INTO FAVORITES(user_id,entity_type,entity_id) VALUES (:actor,:type,:id)",
            ModuleRules.P(("actor",actor),("type",type),("id",id)),ct);
        return new { entityType=type,entityId=id,alreadySaved=false };
    }
    public Task<int> Unfavorite(ClaimsPrincipal user,long id,CancellationToken ct)=>db.Execute(
        "DELETE FROM FAVORITES WHERE favorite_id=:id AND user_id=:actor",
        ModuleRules.P(("id",id),("actor",ModuleRules.UserId(user))),ct);
    public Task<List<Dictionary<string,object?>>> Queue(CancellationToken ct)=>db.Query(@"
        SELECT report_id AS ""id"",listing_type AS ""entityType"",listing_id AS ""entityId"",reason_code AS ""reasonCode"",
            review_state AS ""status"",created_at AS ""createdAt""
        FROM LISTING_REPORTS WHERE review_state IN ('OPEN','IN_REVIEW') ORDER BY created_at
        FETCH FIRST 100 ROWS ONLY",null,ct);

    public async Task<object> Review(ClaimsPrincipal user,ReviewDecision request,CancellationToken ct)
    {
        if(!user.IsInRole("ADMIN")) throw new DomainException(DomainErrors.Forbidden());
        var actor=ModuleRules.UserId(user);
        var type=ModuleRules.Text(request.EntityType,20,"entityType").ToUpperInvariant();
        var reason=ModuleRules.Text(request.ReasonCode,80,"reasonCode");
        var (table,idColumn,approveStatus,rejectStatus,expectedStatus)=type switch
        {
            "ADOPTION"=>("ADOPTION_LISTINGS","adoption_id","PUBLISHED","REJECTED","PENDING_REVIEW"),
            "PET_SALE"=>("PET_SALE_LISTINGS","sale_listing_id","ACTIVE","REJECTED","PENDING_REVIEW"),
            "LOST_FOUND"=>("LOST_FOUND_POSTS","post_id","OPEN","REMOVED","DRAFT"),
            "DONATION"=>("DONATION_CAMPAIGNS","campaign_id","PUBLISHED","REJECTED","PENDING_REVIEW"),
            "FOOD_PRODUCT"=>("FOOD_PRODUCTS","product_id","ACTIVE","ARCHIVED","DRAFT"),
            _=>throw new DomainException(DomainErrors.ValidationFailed(
                new Dictionary<string,string[]> { ["entityType"]=["Unsupported review type."] }))
        };
        // The SQL identifiers come exclusively from the closed switch above.
        return await db.Transaction<object>(async (c,t)=>{
            var admin=await db.One("SELECT user_id FROM USERS WHERE user_id=:id AND role='ADMIN' AND status='ACTIVE'",
                ModuleRules.P(("id",actor)),ct,c,t);
            ModuleRules.Found(admin is not null);
            var row=await db.One($"SELECT status FROM {table} WHERE {idColumn}=:id FOR UPDATE",
                ModuleRules.P(("id",request.EntityId)),ct,c,t);
            ModuleRules.Found(row is not null);
            ModuleRules.Conflict(ModuleRules.Str(row!,"STATUS")==expectedStatus,"Listing is not awaiting this decision.");
            if(request.Approve && type=="PET_SALE")
            {
                var approved=await db.Scalar(@"SELECT COUNT(*) FROM PET_SALE_LISTINGS l JOIN FILE_ASSETS f
                   ON f.file_id=l.welfare_evidence_file_id AND f.scan_status='SAFE'
                   WHERE l.sale_listing_id=:id",ModuleRules.P(("id",request.EntityId)),ct,c,t);
                ModuleRules.Conflict(Convert.ToInt64(approved)==1,"Welfare evidence has not passed review.");
            }
            if(request.Approve && type=="DONATION")
            {
                var verified=await db.Scalar(@"SELECT COUNT(*) FROM DONATION_CAMPAIGNS cam
                    JOIN USER_CAPABILITIES cap ON cap.user_id=cam.beneficiary_id
                    WHERE cam.campaign_id=:id AND cap.capability='VERIFIED_BENEFICIARY'
                    AND cap.status='ACTIVE' AND cap.revoked_at IS NULL
                    AND (cap.expires_at IS NULL OR cap.expires_at>SYSTIMESTAMP)",
                    ModuleRules.P(("id",request.EntityId)),ct,c,t);
                ModuleRules.Conflict(Convert.ToInt64(verified)==1,"Verified beneficiary grant is required.");
            }
            if(request.Approve && type=="FOOD_PRODUCT")
            {
                var valid=await db.Scalar(@"SELECT COUNT(*) FROM FOOD_PRODUCTS p JOIN FOOD_CATEGORIES cat
                    ON cat.category_id=p.category_id AND cat.status='ACTIVE' WHERE p.product_id=:id",
                    ModuleRules.P(("id",request.EntityId)),ct,c,t);
                ModuleRules.Conflict(Convert.ToInt64(valid)==1,"Product category is not active.");
            }
            var status=request.Approve?approveStatus:rejectStatus;
            var additional=type switch
            {
                "ADOPTION" or "PET_SALE" =>
                    ", reviewed_by_user_id=:actor,reviewed_at=SYSTIMESTAMP"+
                        (request.Approve?",posted_at=SYSTIMESTAMP":""),
                "LOST_FOUND" => ", reviewed_by_user_id=:actor"+
                       (request.Approve?",published_at=SYSTIMESTAMP":""),
                "DONATION" => ", reviewed_by_user_id=:actor,reviewed_at=SYSTIMESTAMP"+
                    (request.Approve?",verification_status='VERIFIED'":""),
                _ => ""
            };
            var binds=type=="FOOD_PRODUCT" ? ModuleRules.P(("status",status),("id",request.EntityId))
                : ModuleRules.P(("status",status),("id",request.EntityId),("actor",actor));
            await db.Execute($"UPDATE {table} SET status=:status{additional} WHERE {idColumn}=:id",
                binds,ct,c,t);
            await db.Execute(@"INSERT INTO MODERATION_ACTIONS(actor_user_id,entity_type,entity_id,action_code,reason_code)
                VALUES (:actor,:type,:id,:action,:reason)",
                ModuleRules.P(("actor",actor),("type",type),("id",request.EntityId),
                    ("action",request.Approve?"APPROVE":"REJECT"),("reason",reason)),ct,c,t);
            return new { id=request.EntityId,status };
        },ct);
    }
}
