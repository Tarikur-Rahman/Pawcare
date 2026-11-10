using PawCare.Api.Common;
namespace PawCare.Api.Modules.Orders;
public static class OrderEndpoints
{
    public static IEndpointRouteBuilder MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1").RequireAuthorization().WithTags("Orders");
        g.MapPost("/checkout",async (HttpContext c,CheckoutRequest r,CheckoutService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Checkout(c.User,r,c.Request.Headers["Idempotency-Key"].ToString(),ct)));
        g.MapGet("/orders",async (HttpContext c,CheckoutService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Orders(c.User,ct)));
        g.MapGet("/orders/{id:long}",async (long id,HttpContext c,CheckoutService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Order(c.User,id,ct)));
        g.MapPost("/orders/{id:long}/cancel",async (long id,HttpContext c,CheckoutService s,CancellationToken ct)=>{
            await s.Cancel(c.User,id,ct);return Results.NoContent(); });
        return app;
    }
}
