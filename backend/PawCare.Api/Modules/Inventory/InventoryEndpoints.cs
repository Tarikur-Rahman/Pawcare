using PawCare.Api.Common;
namespace PawCare.Api.Modules.Inventory;
public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/admin/inventory").RequireAuthorization().WithTags("Inventory");
        g.MapGet("/",async (HttpContext c,InventoryService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.List(c.User,ct)));
        g.MapPost("/adjust",async (HttpContext c,InventoryAdjustment r,InventoryService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Adjust(c.User,r,ct)));
        return app;
    }
}
