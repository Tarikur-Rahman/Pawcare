using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Appointments;
public sealed class BookingRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Vets(CancellationToken ct)=>db.Query(@"
        SELECT u.user_id AS ""id"",p.display_name AS ""displayName"" FROM USERS u
        JOIN USER_PROFILES p ON p.user_id=u.user_id
        WHERE u.role='VET' AND u.status='ACTIVE' ORDER BY p.display_name FETCH FIRST 100 ROWS ONLY",null,ct);
    public Task<List<Dictionary<string,object?>>> List(long user,string role,CancellationToken ct)=>db.Query(@"
        SELECT a.appointment_id AS ""id"",a.pet_id AS ""petId"",a.vet_user_id AS ""vetId"",a.starts_at AS ""startsAt"",
        a.ends_at AS ""endsAt"",a.status,a.reason FROM APPOINTMENTS a JOIN PETS p ON p.pet_id=a.pet_id
        WHERE (p.owner_user_id=:user_id OR (:role='VET' AND a.vet_user_id=:user_id))
        ORDER BY a.starts_at DESC FETCH FIRST 100 ROWS ONLY",ModuleRules.P(("user_id",user),("role",role)),ct);

    public async Task<long> Book(long owner,long pet,long vet,DateTimeOffset start,DateTimeOffset end,string? reason,CancellationToken ct)=>
        await db.Transaction(async (conn,tx)=> {
            // Vet row is the serialization lock for bookings by all API instances.
            var vetRow=await db.One(@"SELECT user_id FROM USERS WHERE user_id=:id AND role='VET' AND status='ACTIVE'
                FOR UPDATE",ModuleRules.P(("id",vet)),ct,conn,tx);
            ModuleRules.Found(vetRow is not null);
            var petRow=await db.One(@"SELECT pet_id FROM PETS WHERE pet_id=:pet AND owner_user_id=:owner
                AND status='ACTIVE'",ModuleRules.P(("pet",pet),("owner",owner)),ct,conn,tx);
            ModuleRules.Found(petRow is not null);
            var count=await db.Scalar(@"SELECT COUNT(*) FROM APPOINTMENTS
                WHERE vet_user_id=:vet AND status IN ('REQUESTED','CONFIRMED')
                  AND starts_at<:ends_at AND ends_at>:starts_at",ModuleRules.P(("vet",vet),
                    ("starts_at",start),("ends_at",end)),ct,conn,tx);
            ModuleRules.Conflict(Convert.ToInt64(count)==0,"This veterinarian has an overlapping appointment.");
            return await db.InsertId(@"INSERT INTO APPOINTMENTS(pet_id,vet_user_id,created_by_user_id,starts_at,ends_at,reason)
                VALUES (:pet,:vet,:owner,:starts_at,:ends_at,:reason)",
                ModuleRules.P(("pet",pet),("vet",vet),("owner",owner),("starts_at",start),
                    ("ends_at",end),("reason",reason)),"appointment_id",ct,conn,tx);
        },ct);

    public Task<int> Cancel(long user,long id,CancellationToken ct)=>db.Execute(@"
       UPDATE APPOINTMENTS SET status='CANCELLED',updated_at=SYSTIMESTAMP WHERE appointment_id=:id
         AND status IN ('REQUESTED','CONFIRMED') AND EXISTS
         (SELECT 1 FROM PETS p WHERE p.pet_id=APPOINTMENTS.pet_id AND p.owner_user_id=:user_id)",
        ModuleRules.P(("id",id),("user_id",user)),ct);
    public Task<int> VetConfirm(long vet,long id,CancellationToken ct)=>db.Execute(@"
        UPDATE APPOINTMENTS SET status='CONFIRMED',updated_at=SYSTIMESTAMP
        WHERE appointment_id=:id AND vet_user_id=:vet AND status='REQUESTED'",
        ModuleRules.P(("id",id),("vet",vet)),ct);
    public Task<int> VetTransition(long vet,long id,string target,string required,CancellationToken ct)=>db.Execute(@"
        UPDATE APPOINTMENTS SET status=:target,updated_at=SYSTIMESTAMP
        WHERE appointment_id=:id AND vet_user_id=:vet AND status=:required",
        ModuleRules.P(("target",target),("id",id),("vet",vet),("required",required)),ct);
}
