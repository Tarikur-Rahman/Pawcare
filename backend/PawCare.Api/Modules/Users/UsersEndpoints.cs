using PawCare.Api.Common;
namespace PawCare.Api.Modules.Users;
public static class UsersEndpoints
{
    public static IEndpointRouteBuilder MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/users/me").RequireAuthorization().WithTags("Users");
        g.MapGet("/",async (HttpContext c,UsersService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Profile(c.User,ct)));
        g.MapPatch("/",async (HttpContext c,ProfileUpdate r,UsersService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Update(c.User,r,ct)));
        g.MapGet("/addresses",async (HttpContext c,UsersService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Addresses(c.User,ct)));
        g.MapPost("/addresses",async (HttpContext c,AddressCreate r,UsersService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.AddAddress(c.User,r,ct)));
        return app;
    }
}
