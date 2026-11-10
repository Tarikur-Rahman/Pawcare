using PawCare.Api.Common;
namespace PawCare.Api.Modules.Marketplace;
public static class MarketplaceEndpoints
{
    public static IEndpointRouteBuilder MapMarketplaceEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/marketplace").WithTags("Marketplace");
        g.MapGet("/pets",async (HttpContext c,MarketplaceService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Public(ct))).AllowAnonymous();
        g.MapGet("/pets/{id:long}",async (long id,HttpContext c,MarketplaceService s,CancellationToken ct)=>{
            var row=await s.Detail(id,ct);return row is null?ApiResponses.Error(c,DomainErrors.NotFound()):ApiResponses.Ok(c,row);
        }).AllowAnonymous();
        g.MapPost("/pets",async (HttpContext c,SaleDraft r,MarketplaceService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Draft(c.User,r,ct))).RequireAuthorization();
        g.MapPost("/pets/{id:long}/submit",async (long id,HttpContext c,MarketplaceService s,CancellationToken ct)=>{
            await s.Submit(c.User,id,ct);return Results.NoContent();
        }).RequireAuthorization();
        g.MapPost("/inquiries",async (HttpContext c,SaleInquiry r,MarketplaceService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Inquire(c.User,r,ct))).RequireAuthorization();
        g.MapGet("/inquiries",async (HttpContext c,MarketplaceService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Inquiries(c.User,ct))).RequireAuthorization();
        g.MapPost("/sales",(HttpContext c)=>ApiResponses.Error(c,MarketplaceService.SalesDisabled()))
            .RequireAuthorization().WithName("PetSaleDisabledUntilApproved");
        return app;
    }
}
