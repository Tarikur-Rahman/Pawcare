using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Pets;
public sealed class PetRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> List(long user,CancellationToken ct)=>db.Query(@"
        SELECT pet_id AS ""id"",name,species,breed,sex,status,date_of_birth AS ""dateOfBirth"",attributes_json AS ""attributesJson""
        FROM PETS WHERE owner_user_id=:user_id AND status='ACTIVE' ORDER BY pet_id DESC",
        ModuleRules.P(("user_id",user)),ct);
    public Task<Dictionary<string,object?>?> Get(long user,long id,CancellationToken ct)=>db.One(@"
        SELECT pet_id AS ""id"", name,species,breed,sex,status,date_of_birth AS ""dateOfBirth"",attributes_json AS ""attributesJson""
        FROM PETS WHERE pet_id=:id AND owner_user_id=:user_id AND status='ACTIVE'",
        ModuleRules.P(("id",id),("user_id",user)),ct);
    public Task<long> Create(long user,string name,string species,string? breed,string sex,DateTime? dateOfBirth,
        string? attributes,CancellationToken ct)=>
        db.InsertId(@"INSERT INTO PETS(owner_user_id,name,species,breed,sex,date_of_birth,attributes_json)
           VALUES (:user_id,:name,:species,:breed,:sex,:date_of_birth,:attributes)",
            ModuleRules.P(("user_id",user),("name",name),("species",species),("breed",breed),("sex",sex),
                ("date_of_birth",dateOfBirth),("attributes",attributes)),"pet_id",ct);
    public Task<int> Update(long user,long id,string name,string? breed,DateTime? dateOfBirth,string? attributes,CancellationToken ct)=>db.Execute(@"
        UPDATE PETS SET name=:name,breed=:breed,date_of_birth=:date_of_birth,attributes_json=:attributes,updated_at=SYSTIMESTAMP
        WHERE pet_id=:id AND owner_user_id=:user_id AND status='ACTIVE'",
        ModuleRules.P(("name",name),("breed",breed),("date_of_birth",dateOfBirth),("attributes",attributes),
            ("id",id),("user_id",user)),ct);
    public Task<int> Archive(long user,long id,CancellationToken ct)=>db.Execute(@"
        UPDATE PETS SET status='ARCHIVED',archived_at=SYSTIMESTAMP,updated_at=SYSTIMESTAMP
        WHERE pet_id=:id AND owner_user_id=:user_id AND status='ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM PET_LISTING_LOCKS l WHERE l.pet_id=:id)",
        ModuleRules.P(("id",id),("user_id",user)),ct);
}
