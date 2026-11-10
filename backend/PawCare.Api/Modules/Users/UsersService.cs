using System.Security.Claims;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Users;
public sealed record ProfileUpdate(string DisplayName,string TimeZone,string Locale,string? Phone = null);
public sealed record AddressCreate(string RecipientName,string Line1,string City,string CountryCode,string Scope);
public sealed class UsersService(UsersRepository repository)
{
    public Task<Dictionary<string,object?>?> Profile(ClaimsPrincipal user,CancellationToken ct)=>
        repository.Profile(ModuleRules.UserId(user),ct);
    public async Task<object> Update(ClaimsPrincipal user,ProfileUpdate request,CancellationToken ct)
    {
        var name=ModuleRules.Text(request.DisplayName,120,"displayName");
        var tz=ModuleRules.Text(request.TimeZone,64,"timeZone");
        var locale=ModuleRules.Text(request.Locale,16,"locale");
        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : ModuleRules.Text(request.Phone,20,"phone");
        ModuleRules.Check(phone is null || System.Text.RegularExpressions.Regex.IsMatch(
            phone, @"^\+[1-9][0-9]{6,14}$"), "phone", "Use an E.164 phone number.");
        await repository.Update(ModuleRules.UserId(user),name,tz,locale,phone,ct);
        return (await Profile(user,ct))!;
    }
    public Task<List<Dictionary<string,object?>>> Addresses(ClaimsPrincipal user,CancellationToken ct)=>
        repository.Addresses(ModuleRules.UserId(user),ct);
    public async Task<object> AddAddress(ClaimsPrincipal user,AddressCreate r,CancellationToken ct)
    {
        var scope=ModuleRules.Text(r.Scope,8,"scope").ToUpperInvariant();
        ModuleRules.Check(scope is "SHIPPING" or "BILLING","scope");
        var country=ModuleRules.Text(r.CountryCode,2,"countryCode").ToUpperInvariant();
        ModuleRules.Check(country.Length==2 && country.All(c=>c is >= 'A' and <= 'Z'),"countryCode");
        var id=await repository.AddAddress(ModuleRules.UserId(user),
            ModuleRules.Text(r.RecipientName,160,"recipientName"), ModuleRules.Text(r.Line1,200,"line1"),
            ModuleRules.Text(r.City,100,"city"),country,scope,ct);
        return new { id, scope };
    }
}
