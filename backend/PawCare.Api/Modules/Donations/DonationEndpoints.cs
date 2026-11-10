using PawCare.Api.Common;
namespace PawCare.Api.Modules.Donations;
public static class DonationEndpoints
{
    public static IEndpointRouteBuilder MapDonationEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/donation-campaigns").WithTags("Donations");
        g.MapGet("/",async (HttpContext c,DonationService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Public(ct))).AllowAnonymous();
        g.MapPost("/",async (HttpContext c,DonationCampaignCreate r,DonationService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Draft(c.User,r,ct))).RequireAuthorization();
        g.MapPost("/{id:long}/submit",async (long id,HttpContext c,DonationService s,CancellationToken ct)=>{
            await s.Submit(c.User,id,ct);return Results.NoContent();
        }).RequireAuthorization();
        app.MapPost("/api/v1/donation-contributions",(HttpContext c)=>
            ApiResponses.Error(c,DonationService.PaymentsUnavailable())).RequireAuthorization().WithTags("Donations");
        return app;
    }
}
