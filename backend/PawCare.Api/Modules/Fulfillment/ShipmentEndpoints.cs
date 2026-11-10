using PawCare.Api.Common;
namespace PawCare.Api.Modules.Fulfillment;
public static class ShipmentEndpoints
{
    public static IEndpointRouteBuilder MapShipmentEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/orders/{orderId:long}/shipments").RequireAuthorization().WithTags("Fulfillment");
        g.MapGet("/",async (long orderId,HttpContext c,FulfillmentService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.ListOwn(c.User,orderId,ct)));
        g.MapPost("/",async (long orderId,HttpContext c,ShipmentCreate r,FulfillmentService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Ship(c.User,orderId,r,ct)));
        return app;
    }
}
