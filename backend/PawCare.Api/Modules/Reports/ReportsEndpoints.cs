using PawCare.Api.Common;
namespace PawCare.Api.Modules.Reports;
public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/reports").RequireAuthorization().WithTags("Reports");
        g.MapGet("/dashboard",async (HttpContext c,ReportsService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Dashboard(c.User,ct)));
        g.MapGet("/store-sales",async (HttpContext c,ReportsService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.StoreSales(c.User,ct)));
        return app;
    }
}
