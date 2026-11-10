using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Care;
public sealed class CareRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Tasks(long owner,long pet,CancellationToken ct)=>db.Query(@"
        SELECT t.care_task_id AS ""id"",t.task_type AS ""type"",t.title,t.due_at AS ""dueAt"",t.status,
               t.recurrence_rule AS ""recurrenceRule"" FROM CARE_TASKS t JOIN PETS p ON p.pet_id=t.pet_id
        WHERE p.pet_id=:pet AND p.owner_user_id=:owner ORDER BY t.due_at DESC FETCH FIRST 200 ROWS ONLY",
        ModuleRules.P(("pet",pet),("owner",owner)),ct);
    public Task<long> Create(long owner,long pet,string title,string type,DateTimeOffset due,string? recurrence,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var p=await db.One("SELECT pet_id FROM PETS WHERE pet_id=:pet AND owner_user_id=:owner AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("pet",pet),("owner",owner)),ct,c,t);
            ModuleRules.Found(p is not null);
            return await db.InsertId(@"INSERT INTO CARE_TASKS(pet_id,title,task_type,due_at,recurrence_rule,created_by_user_id)
                VALUES (:pet,:title,:type,:due,:recurrence,:owner)",
                ModuleRules.P(("pet",pet),("title",title),("type",type),("due",due),
                  ("recurrence",recurrence),("owner",owner)),"care_task_id",ct,c,t);
        },ct);
    public Task<int> Complete(long owner,long id,CancellationToken ct)=>db.Execute(@"
        UPDATE CARE_TASKS SET status='COMPLETED',completed_at=SYSTIMESTAMP,updated_at=SYSTIMESTAMP
        WHERE care_task_id=:id AND status='PENDING' AND EXISTS
        (SELECT 1 FROM PETS p WHERE p.pet_id=CARE_TASKS.pet_id AND p.owner_user_id=:owner)",
        ModuleRules.P(("id",id),("owner",owner)),ct);
    public Task<int> Cancel(long owner,long id,CancellationToken ct)=>db.Execute(@"
        UPDATE CARE_TASKS SET status='CANCELLED',updated_at=SYSTIMESTAMP
        WHERE care_task_id=:id AND status='PENDING' AND EXISTS
        (SELECT 1 FROM PETS p WHERE p.pet_id=CARE_TASKS.pet_id AND p.owner_user_id=:owner)",
        ModuleRules.P(("id",id),("owner",owner)),ct);
}
