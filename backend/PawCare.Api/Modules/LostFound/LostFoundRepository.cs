using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.LostFound;
public sealed class LostFoundRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Public(CancellationToken ct)=>db.Query(@"
        SELECT post_id AS ""id"",category,species,general_area AS ""generalArea"",observed_at AS ""observedAt""
        FROM LOST_FOUND_POSTS WHERE status='OPEN' ORDER BY published_at DESC FETCH FIRST 100 ROWS ONLY",null,ct);
    public Task<Dictionary<string,object?>?> Detail(long id,CancellationToken ct)=>db.One(@"
        SELECT post_id AS ""id"",category,species,general_area AS ""generalArea"",observed_at AS ""observedAt""
        FROM LOST_FOUND_POSTS WHERE status='OPEN' AND post_id=:id",ModuleRules.P(("id",id)),ct);
    public Task<long> Draft(long actor,string kind,string species,string description,string area,DateTimeOffset observed,CancellationToken ct)=>
        db.InsertId(@"INSERT INTO LOST_FOUND_POSTS(poster_id,category,species,description,general_area,observed_at)
          VALUES (:actor,:kind,:species,:description,:area,:observed)",
        ModuleRules.P(("actor",actor),("kind",kind),("species",species),("description",description),
            ("area",area),("observed",observed)),"post_id",ct);
    public Task<long> Sighting(long actor,long post,string area,DateTimeOffset observed,string description,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var row=await db.One("SELECT poster_id FROM LOST_FOUND_POSTS WHERE post_id=:id AND status='OPEN' FOR UPDATE",
                ModuleRules.P(("id",post)),ct,c,t);
            ModuleRules.Found(row is not null && ModuleRules.Id(row,"POSTER_ID")!=actor);
            return await db.InsertId(@"INSERT INTO SIGHTINGS(post_id,reporter_id,approximate_area,observed_at,description_private)
                VALUES (:post,:actor,:area,:observed,:description)",
                ModuleRules.P(("post",post),("actor",actor),("area",area),("observed",observed),
                    ("description",description)),"sighting_id",ct,c,t);
        },ct);
    public Task<List<Dictionary<string,object?>>> Sightings(long actor,long post,CancellationToken ct)=>db.Query(@"
        SELECT s.sighting_id AS ""id"",s.approximate_area AS ""approximateArea"",s.observed_at AS ""observedAt"",
             s.description_private AS ""description"",s.status
        FROM SIGHTINGS s JOIN LOST_FOUND_POSTS p ON p.post_id=s.post_id
        WHERE p.post_id=:post AND p.poster_id=:actor ORDER BY s.created_at DESC",
        ModuleRules.P(("post",post),("actor",actor)),ct);
    public ModuleDb Db=>db;
    public Task<long> Claim(long actor,long post,long asset,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var row=await db.One("SELECT poster_id FROM LOST_FOUND_POSTS WHERE post_id=:id AND status='OPEN' FOR UPDATE",
                ModuleRules.P(("id",post)),ct,c,t);
            ModuleRules.Found(row is not null && ModuleRules.Id(row,"POSTER_ID")!=actor);
            var proof=await db.One(@"SELECT file_id FROM FILE_ASSETS WHERE file_id=:id AND owner_user_id=:actor
                AND scan_status='SAFE' AND access_policy='REVIEWER_ONLY' AND deleted_at IS NULL",
                ModuleRules.P(("id",asset),("actor",actor)),ct,c,t);
            ModuleRules.Found(proof is not null);
            return await db.InsertId(@"INSERT INTO REUNIFICATION_CLAIMS(post_id,claimant_id,proof_asset_id)
                VALUES (:post,:actor,:asset)",
                ModuleRules.P(("post",post),("actor",actor),("asset",asset)),"claim_id",ct,c,t);
        },ct);
}
