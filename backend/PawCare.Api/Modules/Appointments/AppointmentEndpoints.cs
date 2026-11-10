using PawCare.Api.Common;
namespace PawCare.Api.Modules.Appointments;
public static class AppointmentEndpoints
{
    public static IEndpointRouteBuilder MapAppointmentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/vets",async (HttpContext c,BookingService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.Vets(ct))).AllowAnonymous().WithTags("Appointments");
        var g=app.MapGroup("/api/v1/appointments").RequireAuthorization().WithTags("Appointments");
        g.MapGet("/",async (HttpContext c,BookingService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.List(c.User,ct)));
        g.MapPost("/",async (HttpContext c,BookingRequest r,BookingService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Book(c.User,r,ct)))
            .RequireAuthorization("OwnerOnly");
        g.MapPost("/{id:long}/cancel",async (long id,HttpContext c,BookingService s,CancellationToken ct)=>{
            await s.Cancel(c.User,id,ct);return Results.NoContent();}).RequireAuthorization("OwnerOnly");
        g.MapPost("/{id:long}/confirm",async (long id,HttpContext c,BookingService s,CancellationToken ct)=>{
            await s.Confirm(c.User,id,ct);return Results.NoContent();}).RequireAuthorization("VetOnly");
        g.MapPost("/{id:long}/reject",async (long id,HttpContext c,BookingService s,CancellationToken ct)=>{
            await s.Reject(c.User,id,ct);return Results.NoContent();}).RequireAuthorization("VetOnly");
        g.MapPost("/{id:long}/complete",async (long id,HttpContext c,BookingService s,CancellationToken ct)=>{
            await s.Complete(c.User,id,ct);return Results.NoContent();}).RequireAuthorization("VetOnly");
        g.MapPost("/{id:long}/no-show",async (long id,HttpContext c,BookingService s,CancellationToken ct)=>{
            await s.NoShow(c.User,id,ct);return Results.NoContent();}).RequireAuthorization("VetOnly");
        return app;
    }
}
