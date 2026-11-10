using System.Security.Claims;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Appointments;
public sealed record BookingRequest(long PetId,long VetId,DateTimeOffset StartsAt,DateTimeOffset EndsAt,string? Reason);
public sealed class BookingService(BookingRepository repository)
{
    public Task<List<Dictionary<string,object?>>> Vets(CancellationToken ct)=>repository.Vets(ct);
    public Task<List<Dictionary<string,object?>>> List(ClaimsPrincipal user,CancellationToken ct)=>
        repository.List(ModuleRules.UserId(user),user.IsInRole("VET")?"VET":"OWNER",ct);
    public async Task<object> Book(ClaimsPrincipal user,BookingRequest r,CancellationToken ct)
    {
        ModuleRules.Positive(r.PetId,"petId");ModuleRules.Positive(r.VetId,"vetId");
        ModuleRules.Check(r.EndsAt>r.StartsAt && r.EndsAt-r.StartsAt<=TimeSpan.FromHours(8),"endsAt");
        ModuleRules.Check(r.StartsAt>DateTimeOffset.UtcNow.AddMinutes(-1),"startsAt","The appointment must be in the future.");
        var reason=string.IsNullOrWhiteSpace(r.Reason)?null:ModuleRules.Text(r.Reason,1000,"reason");
        var id=await repository.Book(ModuleRules.UserId(user),r.PetId,r.VetId,r.StartsAt,r.EndsAt,reason,ct);
        return new { id,status="REQUESTED" };
    }
    public async Task Cancel(ClaimsPrincipal user,long id,CancellationToken ct)=>
        ModuleRules.Conflict(await repository.Cancel(ModuleRules.UserId(user),id,ct)==1);
    public async Task Confirm(ClaimsPrincipal user,long id,CancellationToken ct)=>
        ModuleRules.Conflict(await repository.VetConfirm(ModuleRules.UserId(user),id,ct)==1);
    public async Task Reject(ClaimsPrincipal user,long id,CancellationToken ct)=>
        ModuleRules.Conflict(await repository.VetTransition(ModuleRules.UserId(user),id,"REJECTED", "REQUESTED",ct)==1);
    public async Task Complete(ClaimsPrincipal user,long id,CancellationToken ct)=>
        ModuleRules.Conflict(await repository.VetTransition(ModuleRules.UserId(user),id,"COMPLETED", "CONFIRMED",ct)==1);
    public async Task NoShow(ClaimsPrincipal user,long id,CancellationToken ct)=>
        ModuleRules.Conflict(await repository.VetTransition(ModuleRules.UserId(user),id,"NO_SHOW", "CONFIRMED",ct)==1);
}
