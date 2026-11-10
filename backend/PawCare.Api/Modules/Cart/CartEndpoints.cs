using PawCare.Api.Common;
namespace PawCare.Api.Modules.Cart;
public static class CartEndpoints
{
    public static IEndpointRouteBuilder MapCartEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/cart").RequireAuthorization().WithTags("Cart");
        g.MapGet("/",async (HttpContext c,CartService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.List(c.User,ct)));
        g.MapPut("/items",async (HttpContext c,CartItemSet r,CartService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Set(c.User,r,ct)));
        return app;
    }
}
