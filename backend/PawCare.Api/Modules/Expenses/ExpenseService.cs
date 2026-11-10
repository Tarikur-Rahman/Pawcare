using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Expenses;
public sealed record ExpenseCreate(long AmountMinor,string Currency,string Category,DateTimeOffset OccurredAt,string? Description);
public sealed class ExpenseService(ExpenseRepository repo,IOwnershipGuards guards)
{
    public async Task<object> List(ClaimsPrincipal user,long pet,DateTimeOffset? from,DateTimeOffset? to,string? currency,string? category,CancellationToken ct)
    { await guards.EnsurePetOwnerAsync(user,pet,ct); ModuleRules.Check(from is null || to is null || from<=to,"dateRange");
      return await repo.List(ModuleRules.UserId(user),pet,from,to,NormalizeCurrency(currency),NormalizeCategory(category),ct); }
    public async Task<object> Add(ClaimsPrincipal user,long pet,ExpenseCreate r,CancellationToken ct)
    {
        await guards.EnsurePetOwnerAsync(user,pet,ct);
        ModuleRules.Check(r.AmountMinor>=0 && r.AmountMinor<=1_000_000_000_000L,"amountMinor");
        var currency=ExpenseRules.Currency(r.Currency);
        var category=ExpenseRules.Category(r.Category);
        var id=await repo.Create(ModuleRules.UserId(user),pet,r.AmountMinor,currency,category,r.OccurredAt,
            string.IsNullOrWhiteSpace(r.Description)?null:ModuleRules.Text(r.Description,2000,"description"),ct);
        return new { id };
    }
    public async Task Edit(ClaimsPrincipal user,long id,ExpenseCreate r,CancellationToken ct)
    {
        ModuleRules.Check(r.AmountMinor>=0 && r.AmountMinor<=1_000_000_000_000L,"amountMinor");
        var currency=ExpenseRules.Currency(r.Currency);
        var category=ExpenseRules.Category(r.Category);
        ModuleRules.Conflict(await repo.Update(ModuleRules.UserId(user),id,r.AmountMinor,currency,category,r.OccurredAt,
            string.IsNullOrWhiteSpace(r.Description)?null:ModuleRules.Text(r.Description,2000,"description"),ct)==1);
    }
    public Task<object> Summary(ClaimsPrincipal user,CancellationToken ct)=>
        SummaryCore(ModuleRules.UserId(user),ct);
    private async Task<object> SummaryCore(long id,CancellationToken ct)=>await repo.Summary(id,ct);
    private static string? NormalizeCurrency(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return ExpenseRules.Currency(value);
    }
    private static string? NormalizeCategory(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return ExpenseRules.Category(value);
    }
}
