using PawCare.Api.Common;
namespace PawCare.Api.Modules.Catalog;
public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/shop").WithTags("Food Catalog");
        g.MapGet("/categories",async (HttpContext c,CatalogService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Categories(ct))).AllowAnonymous();
        g.MapGet("/products",async (HttpContext c,CatalogService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Products(ct))).AllowAnonymous();
        g.MapGet("/products/{id:long}",async (long id,HttpContext c,CatalogService s,CancellationToken ct)=>{
            var row=await s.Product(id,ct);return row is null?ApiResponses.Error(c,DomainErrors.NotFound()):ApiResponses.Ok(c,row);
        }).AllowAnonymous();
        g.MapPost("/products",async (HttpContext c,ProductCreate r,CatalogService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Draft(c.User,r,ct))).RequireAuthorization();
        return app;
    }
}
