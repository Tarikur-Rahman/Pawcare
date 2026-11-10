using PawCare.Api.Common;
using PawCare.Api.Modules.Appointments;
using PawCare.Api.Modules.Auth;
using PawCare.Api.Modules.Expenses;
using PawCare.Api.Modules.Shared;
using Xunit;

namespace PawCare.Api.Tests;

public sealed class BackendRegressionTests
{
    [Theory]
    [InlineData("REQUESTED", "CONFIRMED")]
    [InlineData("REQUESTED", "REJECTED")]
    [InlineData("CONFIRMED", "COMPLETED")]
    [InlineData("CONFIRMED", "NO_SHOW")]
    public void AppointmentTransitions_AcceptOnlySupportedStates(string current, string target) =>
        Assert.True(AppointmentRules.CanTransition(current, target));

    [Theory]
    [InlineData("COMPLETED", "CONFIRMED")]
    [InlineData("REJECTED", "COMPLETED")]
    [InlineData("REQUESTED", "COMPLETED")]
    [InlineData("NO_SHOW", "COMPLETED")]
    public void AppointmentTransitions_RejectInvalidStateChanges(string current, string target) =>
        Assert.False(AppointmentRules.CanTransition(current, target));

    [Theory]
    [InlineData("bdt", "BDT")]
    [InlineData(" USD ", "USD")]
    [InlineData("EUR", "EUR")]
    public void ExpenseCurrency_NormalizesValidCodes(string input, string expected) =>
        Assert.Equal(expected, ExpenseRules.Currency(input));

    [Theory]
    [InlineData("")]
    [InlineData("US")]
    [InlineData("US1")]
    [InlineData("USDX")]
    public void ExpenseCurrency_RejectsInvalidCodes(string input)
    {
        var error = Assert.Throws<DomainException>(() => ExpenseRules.Currency(input));
        Assert.Equal("VALIDATION_FAILED", error.Error.Code);
    }

    [Theory]
    [InlineData("food", "FOOD")]
    [InlineData("VET", "VET")]
    public void ExpenseCategory_NormalizesAllowedValues(string input, string expected) =>
        Assert.Equal(expected, ExpenseRules.Category(input));

    [Theory]
    [InlineData("RENT")]
    [InlineData("DROP TABLE")]
    public void ExpenseCategory_RejectsUnsupportedValues(string input) =>
        Assert.Throws<DomainException>(() => ExpenseRules.Category(input));

    [Fact]
    public void ModuleRules_RejectsInvalidOwnershipIdentifiers()
    {
        Assert.Throws<DomainException>(() => ModuleRules.Positive(0, "petId"));
        Assert.Throws<DomainException>(() => ModuleRules.Positive(-1, "expenseId"));
    }

    [Fact]
    public void VerificationTokens_AreOpaqueRandomAndUrlSafe()
    {
        var first = VerificationTokenGenerator.Generate();
        var second = VerificationTokenGenerator.Generate();
        Assert.NotEqual(first, second);
        Assert.InRange(first.Length, 60, 80);
        Assert.DoesNotContain("+", first);
        Assert.DoesNotContain("/", first);
        Assert.DoesNotContain("=", first);
        Assert.NotEqual(first, ModuleRules.Hash(first));
    }

    [Theory]
    [InlineData("DAILY")]
    [InlineData("FREQ=WEEKLY")]
    [InlineData("monthly")]
    public void RecurrenceRules_AcceptDocumentedFrequencies(string input)
    {
        var normalized = PawCare.Api.Modules.Care.RecurrenceRules.Normalize(input);
        Assert.Contains(normalized, new[] { "DAILY", "WEEKLY", "MONTHLY" });
    }

    [Theory]
    [InlineData("HOURLY")]
    [InlineData("FREQ=YEARLY")]
    [InlineData("DAILY;COUNT=3")]
    public void RecurrenceRules_RejectUnsupportedOrAmbiguousFrequencies(string input) =>
        Assert.Throws<DomainException>(() => PawCare.Api.Modules.Care.RecurrenceRules.Normalize(input));
}
