using PawCare.Api.Common;
namespace PawCare.Api.Modules.Moderation;
public static class ModerationEndpoints
{
    public static IEndpointRouteBuilder MapModerationEndpoints(this IEndpointRouteBuilder app)
    {
        var favorites=app.MapGroup("/api/v1/favorites").RequireAuthorization().WithTags("Favorites");
        favorites.MapGet("/",async (HttpContext c,ModerationService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Favorites(c.User,ct)));
        favorites.MapPost("/",async (HttpContext c,FavoriteCreate r,ModerationService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Favorite(c.User,r.EntityType,r.EntityId,ct)));
        favorites.MapDelete("/{id:long}",async (long id,HttpContext c,ModerationService s,CancellationToken ct)=>{
            var deleted=await s.Unfavorite(c.User,id,ct);
            return deleted==1?Results.NoContent():ApiResponses.Error(c,DomainErrors.NotFound());
        });
        app.MapPost("/api/v1/reports/listings",async (HttpContext c,ReportListing r,ModerationService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Report(c.User,r,ct))).RequireAuthorization().WithTags("Moderation");
        var g=app.MapGroup("/api/v1/admin/moderation").RequireAuthorization("AdminOnly").WithTags("Moderation");
        g.MapGet("/",async (HttpContext c,ModerationService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Queue(ct)));
        g.MapPost("/decision",async (HttpContext c,ReviewDecision r,ModerationService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Review(c.User,r,ct)));
        return app;
    }
}
