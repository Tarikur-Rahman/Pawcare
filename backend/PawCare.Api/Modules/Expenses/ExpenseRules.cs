using PawCare.Api.Common;
using PawCare.Api.Modules.Shared;

namespace PawCare.Api.Modules.Expenses;

public static class ExpenseRules
{
    public static string Currency(string value)
    {
        var normalized = ModuleRules.Text(value, 3, "currency").ToUpperInvariant();
        ModuleRules.Check(normalized.Length == 3 && normalized.All(c => c is >= 'A' and <= 'Z'), "currency");
        return normalized;
    }

    public static string Category(string value)
    {
        var normalized = ModuleRules.Text(value, 20, "category").ToUpperInvariant();
        ModuleRules.Check(normalized is "FOOD" or "VET" or "MEDICATION" or "GROOMING" or "TOYS" or "SUPPLIES" or "OTHER", "category");
        return normalized;
    }
}
