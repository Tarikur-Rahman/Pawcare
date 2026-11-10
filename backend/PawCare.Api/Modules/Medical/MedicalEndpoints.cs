using PawCare.Api.Common;
namespace PawCare.Api.Modules.Medical;
public static class MedicalEndpoints
{
    public static IEndpointRouteBuilder MapMedicalEndpoints(this IEndpointRouteBuilder app)
    {
        var g=app.MapGroup("/api/v1/pets/{petId:long}/medical").RequireAuthorization().WithTags("Medical");
        g.MapGet("/",async (long petId,HttpContext c,MedicalService s,CancellationToken ct)=>ApiResponses.Ok(c,await s.Timeline(c.User,petId,ct)));
        g.MapPost("/vaccinations",async (long petId,HttpContext c,VaccineCreate r,MedicalService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.AddVaccine(c.User,petId,r,ct)));
        g.MapPost("/medications",async (long petId,HttpContext c,MedicationCreate r,MedicalService s,CancellationToken ct)=>
            ApiResponses.Ok(c,await s.AddMedication(c.User,petId,r,ct)));
        return app;
    }
}
