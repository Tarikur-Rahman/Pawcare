using PawCare.Api.Common;
namespace PawCare.Api.Modules.Adoption;
public static class AdoptionEndpoints
{
    public static IEndpointRouteBuilder MapAdoptionEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/adoptions").WithTags("Adoption");
        g.MapGet("/",async (HttpContext c,AdoptionService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Public(ct))).AllowAnonymous();
        g.MapGet("/{id:long}",async (long id,HttpContext c,AdoptionService s,CancellationToken ct)=>{
            var item=await s.Detail(id,ct);
            return item is null?ApiResponses.Error(c,DomainErrors.NotFound()):ApiResponses.Ok(c,item);
        }).AllowAnonymous();
        g.MapPost("/",async (HttpContext c,AdoptionCreate r,AdoptionService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Create(c.User,r,ct))).RequireAuthorization("OwnerOnly");
        g.MapPost("/{id:long}/submit",async (long id,HttpContext c,AdoptionService s,CancellationToken ct)=>{
            await s.Submit(c.User,id,ct);return Results.NoContent();
        }).RequireAuthorization();
        g.MapPost("/{id:long}/applications",async (long id,HttpContext c,AdoptionApply r,AdoptionService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Apply(c.User,id,r,ct))).RequireAuthorization();
        g.MapGet("/{id:long}/applications",async (long id,HttpContext c,AdoptionService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Applications(c.User,id,ct))).RequireAuthorization();
        g.MapPost("/{id:long}/applications/{applicationId:long}/decision",async (long id,long applicationId,HttpContext c,
            AdoptionDecision r,AdoptionService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Decide(c.User,id,applicationId,r,ct))).RequireAuthorization();
        g.MapPost("/{id:long}/handover",async (long id,HttpContext c,HandoverService s,CancellationToken ct)=>{
            var key=c.Request.Headers["Idempotency-Key"].ToString();
            return ApiResponses.Ok(c,await s.Confirm(c.User,id,key,ct));
        }).RequireAuthorization();
        return app;
    }
}
