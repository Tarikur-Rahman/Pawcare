using System.Security.Claims;
using PawCare.Api.Modules.Shared;
using PawCare.Api.Security;
namespace PawCare.Api.Modules.Medical;
public sealed record VaccineCreate(string VaccineName,DateTimeOffset AdministeredAt,DateTimeOffset? NextDueAt);
public sealed record MedicationCreate(string MedicationName,string DosageText,DateTimeOffset StartAt,DateTimeOffset? EndAt);
public sealed class MedicalService(MedicalRepository repo,IOwnershipGuards guards)
{
    public async Task<object> Timeline(ClaimsPrincipal user,long pet,CancellationToken ct)
    { await EnsureAccess(user,pet,ct);return await repo.Timeline(pet,ModuleRules.UserId(user),user.IsInRole("VET"),ct); }
    public async Task<object> AddVaccine(ClaimsPrincipal user,long pet,VaccineCreate r,CancellationToken ct)
    {
        await EnsureAccess(user,pet,ct);
        ModuleRules.Check(r.NextDueAt is null || r.NextDueAt>r.AdministeredAt,"nextDueAt");
        var id=await repo.Vaccine(pet,ModuleRules.UserId(user),ModuleRules.Text(r.VaccineName,160,"vaccineName"),
            r.AdministeredAt,r.NextDueAt,user.IsInRole("VET") ? ModuleRules.UserId(user) : (long?)null,ct);return new { id };
    }
    public async Task<object> AddMedication(ClaimsPrincipal user,long pet,MedicationCreate r,CancellationToken ct)
    {
        await EnsureAccess(user,pet,ct);
        ModuleRules.Check(r.EndAt is null || r.EndAt>=r.StartAt,"endAt");
        var id=await repo.Medication(pet,ModuleRules.UserId(user),ModuleRules.Text(r.MedicationName,160,"medicationName"),
            ModuleRules.Text(r.DosageText,300,"dosageText"),r.StartAt,r.EndAt,ct);return new { id };
    }
    private async Task EnsureAccess(ClaimsPrincipal user,long pet,CancellationToken ct)
    {
        if (user.IsInRole("OWNER")) { await guards.EnsurePetOwnerAsync(user,pet,ct); return; }
        ModuleRules.Check(user.IsInRole("VET"), "authorization");
        ModuleRules.Found(await repo.VetHasAppointment(ModuleRules.UserId(user),pet,ct));
    }
}
