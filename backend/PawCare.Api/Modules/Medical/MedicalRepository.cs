using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Medical;
public sealed class MedicalRepository(ModuleDb db)
{
    // Additive timeline details: optional dates and recorded dosage, without changing
    // existing event names, record identifiers, ordering, access checks, or writes.
    // Newly exposed detail fields are owner-only until vet record-consent policy exists.
    public Task<List<Dictionary<string,object?>>> Timeline(long petId,long userId,bool vet,CancellationToken ct)=>db.Query(@"
        SELECT event_type AS ""type"", title, occurred_at AS ""occurredAt"", record_id AS ""id"",
               CASE WHEN :is_vet=1 THEN CAST(NULL AS TIMESTAMP WITH TIME ZONE) ELSE next_due_at END AS ""nextDueAt"",
               CASE WHEN :is_vet=1 THEN CAST(NULL AS VARCHAR2(300)) ELSE dosage_text END AS ""dosageText"",
               CASE WHEN :is_vet=1 THEN CAST(NULL AS TIMESTAMP WITH TIME ZONE) ELSE end_at END AS ""endAt"" FROM (
            SELECT 'VACCINE' event_type, v.vaccine_name title, v.administered_at occurred_at,
                   v.vaccination_id record_id, v.pet_id,
                   v.next_due_at, CAST(NULL AS VARCHAR2(300)) dosage_text,
                   CAST(NULL AS TIMESTAMP WITH TIME ZONE) end_at FROM VACCINATIONS v
            UNION ALL
            SELECT 'MEDICATION', m.medication_name, m.start_at, m.medication_id, m.pet_id,
                   CAST(NULL AS TIMESTAMP WITH TIME ZONE), m.dosage_text, m.end_at FROM MEDICATIONS m
            UNION ALL
            SELECT 'APPOINTMENT', NVL(a.reason,'Veterinary visit'), a.starts_at, a.appointment_id, a.pet_id,
                   CAST(NULL AS TIMESTAMP WITH TIME ZONE), CAST(NULL AS VARCHAR2(300)),
                   CAST(NULL AS TIMESTAMP WITH TIME ZONE) FROM APPOINTMENTS a
        ) WHERE pet_id=:pet_id AND EXISTS (SELECT 1 FROM PETS p WHERE p.pet_id=:pet_id AND
            (p.owner_user_id=:user_id OR (:is_vet=1 AND EXISTS
              (SELECT 1 FROM APPOINTMENTS a WHERE a.pet_id=p.pet_id AND a.vet_user_id=:user_id
               AND a.status IN ('REQUESTED','CONFIRMED','COMPLETED')))))
        ORDER BY ""occurredAt"" DESC,""id"" DESC FETCH FIRST 100 ROWS ONLY",
        ModuleRules.P(("pet_id",petId),("user_id",userId),("is_vet",vet?1:0)),ct);
    public async Task<bool> VetHasAppointment(long vet,long pet,CancellationToken ct) =>
        Convert.ToInt32(await db.Scalar(@"SELECT CASE WHEN EXISTS (SELECT 1 FROM APPOINTMENTS
            WHERE vet_user_id=:vet AND pet_id=:pet AND status IN ('REQUESTED','CONFIRMED','COMPLETED')) THEN 1 ELSE 0 END FROM DUAL",
            ModuleRules.P(("vet",vet),("pet",pet)),ct)) == 1;
    public Task<long> Vaccine(long pet,long owner,string name,DateTimeOffset date,DateTimeOffset? next,long? veterinarian,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var p=await db.One("SELECT pet_id FROM PETS WHERE pet_id=:pet AND owner_user_id=:owner AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("pet",pet),("owner",owner)),ct,c,t);
            ModuleRules.Found(p is not null);
            return await db.InsertId(@"INSERT INTO VACCINATIONS(pet_id,vaccine_name,administered_at,next_due_at,veterinarian_user_id,recorded_by_user_id)
                VALUES (:pet,:name,:date,:next_at,:vet,:owner)",
                ModuleRules.P(("pet",pet),("name",name),("date",date),("next_at",next),("vet",veterinarian),
                    ("owner",owner)),"vaccination_id",ct,c,t);
        },ct);
    public Task<long> Medication(long pet,long owner,string name,string dosage,DateTimeOffset start,DateTimeOffset? end,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var p=await db.One("SELECT pet_id FROM PETS WHERE pet_id=:pet AND owner_user_id=:owner AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("pet",pet),("owner",owner)),ct,c,t);
            ModuleRules.Found(p is not null);
            return await db.InsertId(@"INSERT INTO MEDICATIONS(pet_id,medication_name,dosage_text,start_at,end_at,created_by_user_id)
                VALUES (:pet,:name,:dosage,:start_at,:end_at,:owner)",
                ModuleRules.P(("pet",pet),("name",name),("dosage",dosage),("start_at",start),
                ("end_at",end),("owner",owner)),"medication_id",ct,c,t);
        },ct);
}
