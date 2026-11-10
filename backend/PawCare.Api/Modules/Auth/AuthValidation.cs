using System.Net.Mail;
using PawCare.Api.Modules.Shared;
namespace PawCare.Api.Modules.Auth;
public static class AuthValidation
{
    public static string Email(string? value)
    {
        var email = ModuleRules.Text(value, 254, "email", 3).ToLowerInvariant();
        ModuleRules.Check(email.Length <= 254 && email.All(c => c < 128) &&
            MailAddress.TryCreate(email, out var parsed) &&
            string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase), "email", "Enter a valid email address.");
        return email;
    }
    public static void Password(string? value) => ModuleRules.Check(value is not null &&
        value.Length is >= 12 and <= 128, "password", "Password must be 12 to 128 characters.");
}
