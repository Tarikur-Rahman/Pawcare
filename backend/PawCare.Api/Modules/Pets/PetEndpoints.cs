using PawCare.Api.Common;
namespace PawCare.Api.Modules.Pets;
public static class PetEndpoints
{
    public static IEndpointRouteBuilder MapPetEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/pets").RequireAuthorization("OwnerOnly").WithTags("Pets");
        g.MapGet("/",async (HttpContext c,PetService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.List(c.User,ct)));
        g.MapGet("/{id:long}",async (long id,HttpContext c,PetService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Get(c.User,id,ct)));
        g.MapPost("/",async (HttpContext c,PetCreate r,PetService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Create(c.User,r,ct)));
        g.MapPatch("/{id:long}",async (long id,HttpContext c,PetEdit r,PetService s,CancellationToken ct)=>{
            await s.Edit(c.User,id,r,ct);return Results.NoContent(); });
        g.MapDelete("/{id:long}",async (long id,HttpContext c,PetService s,CancellationToken ct)=>{
            await s.Archive(c.User,id,ct);return Results.NoContent(); });
        return app;
    }
}
