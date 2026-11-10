using System.Security.Claims;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Care;
public sealed record CareTaskCreate(string Type,string Title,DateTimeOffset DueAt,string? RecurrenceRule);
public sealed class CareService(CareRepository repository,IOwnershipGuards guards)
{
    public async Task<object> Tasks(ClaimsPrincipal user,long pet,CancellationToken ct)
    { await guards.EnsurePetOwnerAsync(user,pet,ct);return await repository.Tasks(ModuleRules.UserId(user),pet,ct); }
    public async Task<object> Add(ClaimsPrincipal user,long pet,CareTaskCreate r,CancellationToken ct)
    {
        await guards.EnsurePetOwnerAsync(user,pet,ct);
        var type=ModuleRules.Text(r.Type,20,"type").ToUpperInvariant();
        ModuleRules.Check(type is "FEEDING" or "GROOMING" or "MEDICATION" or "EXERCISE" or "HYGIENE" or "OTHER","type");
        var recurrence = RecurrenceRules.Normalize(r.RecurrenceRule);
        var id=await repository.Create(ModuleRules.UserId(user),pet,ModuleRules.Text(r.Title,160,"title"),
            type,r.DueAt,recurrence,ct);
        return new { id,status="PENDING" };
    }

    public async Task Complete(ClaimsPrincipal user,long id,CancellationToken ct) =>
        ModuleRules.Conflict(await repository.Complete(ModuleRules.UserId(user),id,ct)==1,
            "Care task is missing, already completed, or no longer available.");
    public async Task Cancel(ClaimsPrincipal user,long id,CancellationToken ct) =>
        ModuleRules.Conflict(await repository.Cancel(ModuleRules.UserId(user),id,ct)==1,
            "Care task is missing, already completed, or no longer available.");
}

public static class RecurrenceRules
{
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var rule = ModuleRules.Text(value, 32, "recurrenceRule").ToUpperInvariant();
        return rule switch
        {
            "DAILY" or "WEEKLY" or "MONTHLY" => rule,
            "FREQ=DAILY" => "DAILY",
            "FREQ=WEEKLY" => "WEEKLY",
            "FREQ=MONTHLY" => "MONTHLY",
            _ => throw new DomainException(DomainErrors.ValidationFailed(
                new Dictionary<string, string[]> { ["recurrenceRule"] = ["Use DAILY, WEEKLY, or MONTHLY."] }))
        };
    }
}
