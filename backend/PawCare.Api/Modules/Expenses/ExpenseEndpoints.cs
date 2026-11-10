using PawCare.Api.Common;
namespace PawCare.Api.Modules.Expenses;
public static class ExpenseEndpoints
{
    public static IEndpointRouteBuilder MapExpenseEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1").RequireAuthorization("OwnerOnly").WithTags("Expenses");
        g.MapGet("/pets/{petId:long}/expenses",async (long petId,DateTimeOffset? from,DateTimeOffset? to,string? currency,string? category,HttpContext c,ExpenseService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.List(c.User,petId,from,to,currency,category,ct)));
        g.MapPost("/pets/{petId:long}/expenses",async (long petId,HttpContext c,ExpenseCreate r,ExpenseService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Add(c.User,petId,r,ct)));
        g.MapPatch("/expenses/{id:long}",async (long id,HttpContext c,ExpenseCreate r,ExpenseService s,CancellationToken ct)=>{
            await s.Edit(c.User,id,r,ct); return Results.NoContent();});
        g.MapGet("/reports/expenses",async (HttpContext c,ExpenseService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Summary(c.User,ct)));
        return app;
    }
}
