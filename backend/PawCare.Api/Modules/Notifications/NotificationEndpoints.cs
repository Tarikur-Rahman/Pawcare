using PawCare.Api.Common;
namespace PawCare.Api.Modules.Notifications;
public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/notifications").RequireAuthorization().WithTags("Notifications");
        g.MapGet("/",async (HttpContext c,NotificationService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.List(c.User,ct)));
        g.MapPost("/{id:long}/read",async (long id,HttpContext c,NotificationService s,CancellationToken ct)=>{
            await s.MarkRead(c.User,id,ct);return Results.NoContent();});
        return app;
    }
}
