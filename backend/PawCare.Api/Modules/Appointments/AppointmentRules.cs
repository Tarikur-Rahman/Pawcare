namespace PawCare.Api.Modules.Appointments;

public static class AppointmentRules
{
    public static bool CanTransition(string current, string target) =>
        (current, target) switch
        {
            ("REQUESTED", "CONFIRMED") => true,
            ("REQUESTED", "REJECTED") => true,
            ("REQUESTED", "CANCELLED") => true,
            ("CONFIRMED", "COMPLETED") => true,
            ("CONFIRMED", "NO_SHOW") => true,
            ("CONFIRMED", "CANCELLED") => true,
            _ => false
        };
}
