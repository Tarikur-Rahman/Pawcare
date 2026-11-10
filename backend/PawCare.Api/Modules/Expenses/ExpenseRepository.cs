using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Expenses;
public sealed class ExpenseRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> List(long owner,long pet,DateTimeOffset? from,DateTimeOffset? to,string? currency,string? category,CancellationToken ct)=>db.Query(@"
        SELECT e.expense_id AS ""id"",e.category,e.amount_minor AS ""amountMinor"",e.currency,
        e.description,e.occurred_at AS ""occurredAt"" FROM EXPENSES e JOIN PETS p ON p.pet_id=e.pet_id
        WHERE e.pet_id=:pet AND p.owner_user_id=:owner
          AND (:from_at IS NULL OR e.occurred_at>=:from_at)
          AND (:to_at IS NULL OR e.occurred_at<:to_at)
          AND (:currency IS NULL OR e.currency=:currency)
          AND (:category IS NULL OR e.category=:category)
        ORDER BY e.occurred_at DESC FETCH FIRST 100 ROWS ONLY",
        ModuleRules.P(("pet",pet),("owner",owner),("from_at",from),("to_at",to),
            ("currency",currency),("category",category)),ct);
    public Task<int> Update(long owner,long id,long minor,string currency,string category,DateTimeOffset at,string? description,CancellationToken ct)=>db.Execute(@"
        UPDATE EXPENSES SET amount_minor=:amount,currency=:currency,category=:category,
          occurred_at=:occurred_at,description=:description,updated_at=SYSTIMESTAMP
        WHERE expense_id=:id AND created_by_user_id=:owner
          AND EXISTS (SELECT 1 FROM PETS p WHERE p.pet_id=EXPENSES.pet_id AND p.owner_user_id=:owner)",
        ModuleRules.P(("amount",minor),("currency",currency),("category",category),("occurred_at",at),
            ("description",description),("id",id),("owner",owner)),ct);
    public Task<long> Create(long owner,long pet,long minor,string currency,string category,DateTimeOffset at,string? description,CancellationToken ct)=>
        db.Transaction(async(c,t)=>{
            var p=await db.One("SELECT pet_id FROM PETS WHERE pet_id=:pet AND owner_user_id=:owner AND status='ACTIVE' FOR UPDATE",
                ModuleRules.P(("pet",pet),("owner",owner)),ct,c,t);
            ModuleRules.Found(p is not null);
            return await db.InsertId(@"INSERT INTO EXPENSES(pet_id,amount_minor,currency,category,occurred_at,description,created_by_user_id)
              VALUES (:pet,:amount,:currency,:category,:occurred_at,:description,:owner)",
              ModuleRules.P(("pet",pet),("amount",minor),("currency",currency),("category",category),
               ("occurred_at",at),("description",description),("owner",owner)),"expense_id",ct,c,t);
        },ct);
    public Task<List<Dictionary<string,object?>>> Summary(long owner,CancellationToken ct)=>db.Query(@"
        SELECT e.currency,SUM(e.amount_minor) AS ""totalMinor"",COUNT(*) AS ""count""
        FROM EXPENSES e JOIN PETS p ON p.pet_id=e.pet_id WHERE p.owner_user_id=:owner
        GROUP BY e.currency ORDER BY e.currency",ModuleRules.P(("owner",owner)),ct);
}
