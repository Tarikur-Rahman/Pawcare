using System.Security.Claims;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Notifications;
public sealed class NotificationService(ModuleDb db)
{
    public async Task<object> List(ClaimsPrincipal user,CancellationToken ct)=>await db.Query(@"
        SELECT notification_id AS ""id"",kind,title,body_text AS ""body"",created_at AS ""createdAt"",
           read_at AS ""readAt"" FROM NOTIFICATIONS WHERE user_id=:id
        ORDER BY created_at DESC FETCH FIRST 100 ROWS ONLY",
        ModuleRules.P(("id",ModuleRules.UserId(user))),ct);
    public async Task MarkRead(ClaimsPrincipal user,long id,CancellationToken ct)
    {
        var count=await db.Execute(@"UPDATE NOTIFICATIONS SET read_at=COALESCE(read_at,SYSTIMESTAMP)
          WHERE notification_id=:id AND user_id=:user_id",
          ModuleRules.P(("id",id),("user_id",ModuleRules.UserId(user))),ct);
        ModuleRules.Found(count==1);
    }
}
