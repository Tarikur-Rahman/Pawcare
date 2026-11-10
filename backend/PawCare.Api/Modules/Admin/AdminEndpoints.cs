using PawCare.Api.Common;
namespace PawCare.Api.Modules.Admin;
public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/admin").RequireAuthorization("AdminOnly").WithTags("Admin");
        g.MapGet("/users",async (HttpContext c,AdminService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Users(ct)));
        g.MapPost("/users/{id:long}/activate",async (long id,HttpContext c,AdminActivateRequest r,AdminService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Activate(c.User,id,r,ct)));
        g.MapPost("/users/{id:long}/capabilities",async (long id,HttpContext c,CapabilityGrantRequest r,AdminService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Grant(c.User,id,r,ct)));
        g.MapPost("/capabilities/{id:long}/revoke",async (long id,HttpContext c,CapabilityRevokeRequest r,AdminService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Revoke(c.User,id,r.ReasonCode,ct)));
        g.MapPost("/reunification-claims/{id:long}/verify",async (long id,HttpContext c,
            AdminVerifyClaim r,AdminService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.VerifyReunionClaim(c.User,id,r.ReasonCode,ct)));
        return app;
    }
}
