using Xunit;

namespace PawCare.Api.Tests;

/// <summary>
/// PC-CORE-004: real Oracle-backed API concurrency tests. Scenario fixture steps
/// must target a fresh vet slot, distinct owners, and a dedicated test database.
/// These execute only after feature endpoints and test actors are provisioned.
/// </summary>
public sealed class BookingConcurrencyTests
{
    [Fact]
    public async Task TwoOwnersSameVetSlot_ExactlyOneBookingCommits()
    {
        using var scenario = ContractScenario.Open("booking-same-slot");
        var (first, second) = await scenario.SendConcurrentAsync("ownerABook", "ownerBBook");
        Assert.Equal(1, new[] { first, second }.Count(x => x.Status is 200 or 201));
        Assert.Equal(1, new[] { first, second }.Count(x => x.Status == 409));

        // Vet-scoped read must cover both owners and be filtered to this exact unique fixture slot.
        var read = await scenario.SendAsync("vetReadExactSlot");
        Assert.Equal(200, read.Status);
        Assert.Equal(1, read.RequiredInt64("total"));
    }

    [Fact]
    public async Task PartiallyOverlappingIntervals_CommitAtMostOneReservation()
    {
        using var scenario = ContractScenario.Open("booking-overlap");
        var (first, second) = await scenario.SendConcurrentAsync("ownerABookMorning", "ownerBBookOverlap");
        Assert.Equal(1, new[] { first, second }.Count(x => x.Status is 200 or 201));
        Assert.Equal(1, new[] { first, second }.Count(x => x.Status == 409));
        var read = await scenario.SendAsync("vetReadOverlappingWindow");
        Assert.Equal(200, read.Status);
        Assert.Equal(1, read.RequiredInt64("total"));
    }

    [Fact]
    public async Task UnassignedVet_CannotModifyAnotherVetsBooking()
    {
        using var scenario = ContractScenario.Open("booking-unassigned-vet");
        var before = await scenario.SendAsync("assignedVetRead");
        Assert.Equal(200, before.Status);
        var status = before.RequiredString("data.status");
        var forbidden = await scenario.SendAsync("unassignedVetUpdate");
        Assert.Contains(forbidden.Status, new[] { 403, 404 });
        var after = await scenario.SendAsync("assignedVetRead");
        Assert.Equal(200, after.Status);
        Assert.Equal(status, after.RequiredString("data.status"));
    }
}
