using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Adoption;
public sealed class AdoptionRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Public(CancellationToken ct)=>db.Query(@"
        SELECT adoption_id AS ""id"",title,description,species,general_area AS ""generalArea"",posted_at AS ""postedAt""
        FROM ADOPTION_LISTINGS WHERE status='PUBLISHED' ORDER BY posted_at DESC FETCH FIRST 50 ROWS ONLY",null,ct);
    public Task<Dictionary<string,object?>?> Detail(long id,CancellationToken ct)=>db.One(@"
        SELECT adoption_id AS ""id"",title,description,species,general_area AS ""generalArea"",posted_at AS ""postedAt""
        FROM ADOPTION_LISTINGS WHERE adoption_id=:id AND status='PUBLISHED'",ModuleRules.P(("id",id)),ct);
    public async Task<long> Create(long user,long pet,string title,string description,string area,CancellationToken ct)=>
        await db.Transaction(async (c,t)=>{
            var owned=await db.One(@"SELECT pet_id,species FROM PETS WHERE pet_id=:pet AND owner_user_id=:owner
                AND status='ACTIVE' FOR UPDATE",ModuleRules.P(("pet",pet),("owner",user)),ct,c,t);
            ModuleRules.Found(owned is not null);
            var locked=await db.Scalar("SELECT COUNT(*) FROM PET_LISTING_LOCKS WHERE pet_id=:pet",
                ModuleRules.P(("pet",pet)),ct,c,t);
            ModuleRules.Conflict(Convert.ToInt64(locked)==0,"Pet already has an active listing.");
            var id=await db.InsertId(@"INSERT INTO ADOPTION_LISTINGS(pet_id,creator_id,title,description,species,general_area)
               VALUES (:pet,:owner,:title,:description,:species,:area)",
                ModuleRules.P(("pet",pet),("owner",user),("title",title),("description",description),
                ("species",ModuleRules.Str(owned!,"SPECIES")),("area",area)),"adoption_id",ct,c,t);
            await db.Execute(@"INSERT INTO PET_LISTING_LOCKS(pet_id,listing_type,listing_id)
                VALUES (:pet,'ADOPTION',:id)",ModuleRules.P(("pet",pet),("id",id)),ct,c,t);
            return id;
        },ct);
    public Task<long> Apply(long user,long adoption,string answers,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var listing=await db.One(@"SELECT adoption_id,creator_id FROM ADOPTION_LISTINGS
                 WHERE adoption_id=:id AND status='PUBLISHED' FOR UPDATE",
                ModuleRules.P(("id",adoption)),ct,c,t);
            ModuleRules.Found(listing is not null && ModuleRules.Id(listing,"CREATOR_ID")!=user);
            return await db.InsertId(@"INSERT INTO ADOPTION_APPLICATIONS(adoption_id,applicant_id,answers_private)
                VALUES (:id,:user_id,:answers)",
                ModuleRules.P(("id",adoption),("user_id",user),("answers",answers)),"application_id",ct,c,t);
        },ct);
    public Task<List<Dictionary<string,object?>>> Applications(long owner,long adoption,CancellationToken ct)=>db.Query(@"
        SELECT a.application_id AS ""id"",a.applicant_id AS ""applicantId"",a.status,a.submitted_at AS ""submittedAt""
          FROM ADOPTION_APPLICATIONS a JOIN ADOPTION_LISTINGS l ON l.adoption_id=a.adoption_id
         WHERE a.adoption_id=:id AND l.creator_id=:owner ORDER BY a.submitted_at DESC",
        ModuleRules.P(("id",adoption),("owner",owner)),ct);
    public async Task<long> Decide(long owner,long adoption,long application,bool accept,CancellationToken ct)=>
        await db.Transaction(async (c,t)=>{
            var listing=await db.One(@"SELECT adoption_id,pet_id,status FROM ADOPTION_LISTINGS
                WHERE adoption_id=:id AND creator_id=:owner FOR UPDATE",
                ModuleRules.P(("id",adoption),("owner",owner)),ct,c,t);
            ModuleRules.Found(listing is not null);
            ModuleRules.Conflict(ModuleRules.Str(listing!,"STATUS")=="PUBLISHED");
            var app=await db.One(@"SELECT application_id,applicant_id FROM ADOPTION_APPLICATIONS
                WHERE application_id=:id AND adoption_id=:adoption AND status='SUBMITTED' FOR UPDATE",
                ModuleRules.P(("id",application),("adoption",adoption)),ct,c,t);
            ModuleRules.Found(app is not null);
            await db.Execute(@"UPDATE ADOPTION_APPLICATIONS SET status=:status,
                reviewed_by_user_id=:owner,reviewed_at=SYSTIMESTAMP WHERE application_id=:id",
                ModuleRules.P(("status",accept?"ACCEPTED":"REJECTED"),("owner",owner),("id",application)),ct,c,t);
            if (!accept) return 0L;
            ModuleRules.Conflict(listing!["PET_ID"] is not null,"A linked pet is required for transfer.");
            await db.Execute("UPDATE ADOPTION_LISTINGS SET status='MATCHED' WHERE adoption_id=:id",
                ModuleRules.P(("id",adoption)),ct,c,t);
            await db.Execute(@"UPDATE ADOPTION_APPLICATIONS SET status='REJECTED',reviewed_by_user_id=:owner,
                reviewed_at=SYSTIMESTAMP WHERE adoption_id=:id AND application_id<>:app_id
                AND status IN ('SUBMITTED','IN_REVIEW')",
                ModuleRules.P(("owner",owner),("id",adoption),("app_id",application)),ct,c,t);
            return await db.InsertId(@"INSERT INTO ADOPTION_HANDOVERS
                (adoption_id,application_id,pet_id,prior_owner_id,new_owner_id)
                VALUES (:adoption,:application,:pet,:owner,:adopter)",
                ModuleRules.P(("adoption",adoption),("application",application),
                ("pet",ModuleRules.Id(listing,"PET_ID")),("owner",owner),
                ("adopter",ModuleRules.Id(app!,"APPLICANT_ID"))),"handover_id",ct,c,t);
        },ct);
    public Task<int> Submit(long owner,long adoption,CancellationToken ct)=>db.Execute(@"
        UPDATE ADOPTION_LISTINGS SET status='PENDING_REVIEW',updated_at=SYSTIMESTAMP
        WHERE adoption_id=:id AND creator_id=:owner AND status='DRAFT'",
        ModuleRules.P(("id",adoption),("owner",owner)),ct);
    public ModuleDb Db=>db;
}
