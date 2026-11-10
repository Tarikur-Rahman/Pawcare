using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Marketplace;
public sealed class MarketplaceRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Public(CancellationToken ct)=>db.Query(@"
        SELECT sale_listing_id AS ""id"",title,description,species,general_area AS ""generalArea"",
            asking_minor AS ""askingMinor"",currency,posted_at AS ""postedAt""
        FROM PET_SALE_LISTINGS WHERE status='ACTIVE' ORDER BY posted_at DESC FETCH FIRST 50 ROWS ONLY",null,ct);
    public Task<Dictionary<string,object?>?> Detail(long id,CancellationToken ct)=>db.One(@"
        SELECT sale_listing_id AS ""id"",title,description,species,general_area AS ""generalArea"",
            asking_minor AS ""askingMinor"",currency,posted_at AS ""postedAt""
        FROM PET_SALE_LISTINGS WHERE sale_listing_id=:id AND status='ACTIVE'",
        ModuleRules.P(("id",id)),ct);
    public async Task<long> Draft(long user,long pet,string title,string description,string area,long price,string currency,long evidence,CancellationToken ct)=>
        await db.Transaction(async (c,t)=>{
            var owned=await db.One(@"SELECT pet_id,species FROM PETS WHERE pet_id=:pet AND owner_user_id=:user_id
               AND status='ACTIVE' FOR UPDATE",ModuleRules.P(("pet",pet),("user_id",user)),ct,c,t);
            ModuleRules.Found(owned is not null);
            var asset=await db.One(@"SELECT file_id FROM FILE_ASSETS WHERE file_id=:id AND owner_user_id=:user_id
                AND scan_status='SAFE' AND access_policy='REVIEWER_ONLY' AND deleted_at IS NULL",
                ModuleRules.P(("id",evidence),("user_id",user)),ct,c,t);
            ModuleRules.Found(asset is not null);
            var locked=await db.Scalar("SELECT COUNT(*) FROM PET_LISTING_LOCKS WHERE pet_id=:pet",
                ModuleRules.P(("pet",pet)),ct,c,t);
            ModuleRules.Conflict(Convert.ToInt64(locked)==0,"Pet is already listed for transfer.");
            var id=await db.InsertId(@"INSERT INTO PET_SALE_LISTINGS
                (pet_id,seller_id,title,description,species,general_area,asking_minor,currency,welfare_evidence_file_id)
                VALUES (:pet,:seller,:title,:description,:species,:area,:amount,:currency,:evidence)",
                ModuleRules.P(("pet",pet),("seller",user),("title",title),("description",description),
                    ("species",ModuleRules.Str(owned!,"SPECIES")),("area",area),("amount",price),
                    ("currency",currency),("evidence",evidence)),"sale_listing_id",ct,c,t);
            await db.Execute("INSERT INTO PET_LISTING_LOCKS(pet_id,listing_type,listing_id) VALUES (:pet,'PET_SALE',:listing)",
                ModuleRules.P(("pet",pet),("listing",id)),ct,c,t);
            return id;
        },ct);
    public Task<int> Submit(long seller,long listing,CancellationToken ct)=>db.Execute(@"
        UPDATE PET_SALE_LISTINGS SET status='PENDING_REVIEW',updated_at=SYSTIMESTAMP
        WHERE sale_listing_id=:id AND seller_id=:seller AND status='DRAFT'",
        ModuleRules.P(("id",listing),("seller",seller)),ct);
    public Task<long> Inquire(long user,long listing,string message,CancellationToken ct)=>db.Transaction(async(c,t)=>{
        var row=await db.One("SELECT seller_id FROM PET_SALE_LISTINGS WHERE sale_listing_id=:id AND status='ACTIVE' FOR UPDATE",
            ModuleRules.P(("id",listing)),ct,c,t);
        ModuleRules.Found(row is not null && ModuleRules.Id(row,"SELLER_ID")!=user);
        return await db.InsertId(@"INSERT INTO PET_SALE_INQUIRIES(sale_listing_id,buyer_id,message_private)
            VALUES (:id,:buyer,:message)",
            ModuleRules.P(("id",listing),("buyer",user),("message",message)),"inquiry_id",ct,c,t);
    },ct);
    public Task<List<Dictionary<string,object?>>> MyInquiries(long user,CancellationToken ct)=>db.Query(@"
        SELECT i.inquiry_id AS ""id"",i.sale_listing_id AS ""listingId"",i.buyer_id AS ""buyerId"",
            i.message_private AS ""message"",i.status,i.created_at AS ""createdAt""
        FROM PET_SALE_INQUIRIES i JOIN PET_SALE_LISTINGS l ON l.sale_listing_id=i.sale_listing_id
        WHERE i.buyer_id=:user_id OR l.seller_id=:user_id ORDER BY i.created_at DESC FETCH FIRST 100 ROWS ONLY",
        ModuleRules.P(("user_id",user)),ct);
}
