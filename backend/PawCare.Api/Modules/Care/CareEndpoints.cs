using PawCare.Api.Common;
namespace PawCare.Api.Modules.Care;
public static class CareEndpoints
{
    public static IEndpointRouteBuilder MapCareEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1").RequireAuthorization("OwnerOnly").WithTags("Care");
        g.MapGet("/pets/{petId:long}/tasks",async (long petId,HttpContext c,CareService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Tasks(c.User,petId,ct)));
        g.MapPost("/pets/{petId:long}/tasks",async (long petId,HttpContext c,CareTaskCreate r,CareService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Add(c.User,petId,r,ct)));
        g.MapPost("/tasks/{id:long}/complete",async (long id,HttpContext c,CareService s,CancellationToken ct)=>{
            await s.Complete(c.User,id,ct);return Results.NoContent();});
        g.MapPost("/tasks/{id:long}/cancel",async (long id,HttpContext c,CareService s,CancellationToken ct)=>{
            await s.Cancel(c.User,id,ct);return Results.NoContent();});
        return app;
    }
}
