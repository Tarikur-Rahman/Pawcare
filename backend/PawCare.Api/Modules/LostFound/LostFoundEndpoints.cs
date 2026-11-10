using PawCare.Api.Common;
namespace PawCare.Api.Modules.LostFound;
public static class LostFoundEndpoints
{
    public static IEndpointRouteBuilder MapLostFoundEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/lost-found").WithTags("Lost & Found");
        g.MapGet("/",async (HttpContext c,LostFoundService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Public(ct))).AllowAnonymous();
        g.MapGet("/{id:long}",async (long id,HttpContext c,LostFoundService s,CancellationToken ct)=>{
            var row=await s.Detail(id,ct);return row is null?ApiResponses.Error(c,DomainErrors.NotFound()):ApiResponses.Ok(c,row);
        }).AllowAnonymous();
        g.MapPost("/",async (HttpContext c,LostPostCreate r,LostFoundService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Draft(c.User,r,ct)))
            .RequireAuthorization();
        g.MapPost("/{id:long}/sightings",async (long id,HttpContext c,SightingCreate r,LostFoundService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Sighting(c.User,id,r,ct))).RequireAuthorization();
        g.MapGet("/{id:long}/sightings",async (long id,HttpContext c,LostFoundService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Sightings(c.User,id,ct))).RequireAuthorization();
        g.MapPost("/{id:long}/claims",async (long id,HttpContext c,ReunionClaimCreate r,LostFoundService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Claim(c.User,id,r,ct))).RequireAuthorization();
        g.MapPost("/{id:long}/claims/{claimId:long}/confirm-reunion",async (long id,long claimId,HttpContext c,
            LostFoundService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.ConfirmReunion(c.User,id,claimId,ct)))
            .RequireAuthorization();
        return app;
    }
}
