using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Donations;
public sealed class DonationRepository(ModuleDb db)
{
    public Task<List<Dictionary<string,object?>>> Public(CancellationToken ct)=>db.Query(@"
        SELECT campaign_id AS ""id"",title,purpose,goal_minor AS ""goalMinor"",currency
        FROM DONATION_CAMPAIGNS WHERE status='PUBLISHED' AND verification_status='VERIFIED'
        ORDER BY created_at DESC FETCH FIRST 50 ROWS ONLY",null,ct);
    public Task<long> Draft(long user,string title,string purpose,long goal,string currency,CancellationToken ct)=>
        db.InsertId(@"INSERT INTO DONATION_CAMPAIGNS(beneficiary_id,title,purpose,goal_minor,currency)
          VALUES (:user_id,:title,:purpose,:goal,:currency)",
          ModuleRules.P(("user_id",user),("title",title),("purpose",purpose),("goal",goal),
            ("currency",currency)),"campaign_id",ct);
    public Task<int> Submit(long beneficiary,long id,CancellationToken ct)=>db.Execute(@"
        UPDATE DONATION_CAMPAIGNS SET status='PENDING_REVIEW',updated_at=SYSTIMESTAMP
        WHERE campaign_id=:id AND beneficiary_id=:beneficiary AND status='DRAFT'",
        ModuleRules.P(("id",id),("beneficiary",beneficiary)),ct);
}
