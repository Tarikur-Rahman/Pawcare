using System.Security.Claims;
using System.Text.Json;
using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Pets;
public sealed record PetCreate(string Name,string Species,string? Breed,string Sex,DateTime? DateOfBirth = null,string? AttributesJson = null);
public sealed record PetEdit(string Name,string? Breed,DateTime? DateOfBirth = null,string? AttributesJson = null);
public sealed class PetService(PetRepository repository)
{
    public Task<List<Dictionary<string,object?>>> List(ClaimsPrincipal user,CancellationToken ct)=>
        repository.List(ModuleRules.UserId(user),ct);
    public async Task<object> Get(ClaimsPrincipal user,long id,CancellationToken ct)=>
        await repository.Get(ModuleRules.UserId(user),ModuleRules.Positive(id,"petId"),ct)
        ?? throw new DomainException(DomainErrors.NotFound());
    public async Task<object> Create(ClaimsPrincipal user,PetCreate r,CancellationToken ct)
    {
        var sex=ModuleRules.Text(r.Sex,12,"sex").ToUpperInvariant();
        ModuleRules.Check(sex is "MALE" or "FEMALE" or "UNKNOWN","sex");
        var attributes = ValidateAttributes(r.AttributesJson);
        var id=await repository.Create(ModuleRules.UserId(user),ModuleRules.Text(r.Name,120,"name"),
            ModuleRules.Text(r.Species,80,"species"),
            string.IsNullOrWhiteSpace(r.Breed)?null:ModuleRules.Text(r.Breed,120,"breed"),sex,r.DateOfBirth,attributes,ct);
        return new { id,status="ACTIVE" };
    }
    public async Task Edit(ClaimsPrincipal user,long id,PetEdit r,CancellationToken ct)
    {
        var changed=await repository.Update(ModuleRules.UserId(user),id,ModuleRules.Text(r.Name,120,"name"),
            string.IsNullOrWhiteSpace(r.Breed)?null:ModuleRules.Text(r.Breed,120,"breed"),r.DateOfBirth,
            ValidateAttributes(r.AttributesJson),ct);
        ModuleRules.Found(changed==1);
    }
    public async Task Archive(ClaimsPrincipal user,long id,CancellationToken ct)
    {
        ModuleRules.Conflict(await repository.Archive(ModuleRules.UserId(user),id,ct)==1,
            "Pet not found, archived or associated with an active listing.");
    }

    private static string? ValidateAttributes(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var json = ModuleRules.Text(value, 4000, "attributesJson");
        try
        {
            using var document = JsonDocument.Parse(json);
            ModuleRules.Check(document.RootElement.ValueKind == JsonValueKind.Object, "attributesJson");
        }
        catch (JsonException)
        {
            ModuleRules.Check(false, "attributesJson");
        }
        return json;
    }
}
