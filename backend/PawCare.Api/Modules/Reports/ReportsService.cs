using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Reports;
public sealed class ReportsService(ModuleDb db,IOwnershipGuards guards)
{
    public async Task<object> Dashboard(ClaimsPrincipal user,CancellationToken ct)
    {
        var id=ModuleRules.UserId(user);
        var totals=await db.One(@"SELECT
          (SELECT COUNT(*) FROM PETS p WHERE p.owner_user_id=:id AND p.status='ACTIVE') AS ""petCount"",
          (SELECT COUNT(*) FROM CARE_TASKS t JOIN PETS p ON p.pet_id=t.pet_id
             WHERE p.owner_user_id=:id AND t.status='PENDING') AS ""pendingTasks"",
          (SELECT COUNT(*) FROM APPOINTMENTS a JOIN PETS p ON p.pet_id=a.pet_id
             WHERE p.owner_user_id=:id AND a.status IN ('REQUESTED','CONFIRMED') AND a.starts_at>SYSTIMESTAMP) AS ""upcomingVisits"",
          (SELECT COUNT(*) FROM NOTIFICATIONS n WHERE n.user_id=:id AND n.read_at IS NULL) AS ""unreadNotifications""
          FROM dual",ModuleRules.P(("id",id)),ct);
        return totals!;
    }
    public async Task<object> StoreSales(ClaimsPrincipal user,CancellationToken ct)
    {
        if(!user.IsInRole("ADMIN"))
            await guards.EnsureActiveCapabilityAsync(user,OwnershipGuards.StoreOperator,ct);
        // Do not call the sum of all placed orders 'revenue'. Only verified captured payments.
        return await db.Query(@"SELECT o.currency,COUNT(DISTINCT o.order_id) AS ""orderCount"",
            SUM(o.total_minor) AS ""orderValueMinor"",
            (SELECT NVL(SUM(p.amount_minor),0) FROM PAYMENTS p JOIN ORDERS settled ON settled.order_id=p.order_id
             WHERE p.state='CAPTURED' AND settled.currency=o.currency) AS ""verifiedCapturedMinor""
          FROM ORDERS o GROUP BY o.currency ORDER BY o.currency",null,ct);
    }
}
