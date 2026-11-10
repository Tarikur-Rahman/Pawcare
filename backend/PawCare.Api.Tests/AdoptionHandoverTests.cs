using Xunit;

namespace PawCare.Api.Tests;

/// <summary>
/// PC-ADOPT-004/005/006/008; test API must use real persisted adoption applications,
/// handover approvals, pet ownership, and audit rows in disposable Oracle test schema.
/// </summary>
public sealed class AdoptionHandoverTests
{
    [Fact]
    public async Task OnePartyConfirmation_DoesNotTransferOwnership()
    {
        using var scenario = ContractScenario.Open("adoption-one-sided-handover");
        var petBefore = await scenario.SendAsync("originalOwnerReadPet");
        Assert.Equal(200, petBefore.Status);
        var originalOwner = petBefore.RequiredString("data.ownerUserId");

        var response = await scenario.SendAsync("firstPartyConfirm");
        Assert.Contains(response.Status, new[] { 200, 202 });
        var petAfter = await scenario.SendAsync("originalOwnerReadPet");
        Assert.Equal(originalOwner, petAfter.RequiredString("data.ownerUserId"));
        var listing = await scenario.SendAsync("readListingPrivate");
        Assert.NotEqual("COMPLETED", listing.RequiredString("data.status"));
    }

    [Fact]
    public async Task BothVerifiedParties_TransferPetOnce_AndCloseListing()
    {
        using var scenario = ContractScenario.Open("adoption-complete-handover");
        var originalOwner = (await scenario.SendAsync("readBefore")).RequiredString("data.ownerUserId");
        var first = await scenario.SendAsync("originalOwnerConfirm");
        Assert.Contains(first.Status, new[] { 200, 202 });
        var second = await scenario.SendAsync("adopterConfirm");
        Assert.Contains(second.Status, new[] { 200, 201, 202 });
        var after = await scenario.SendAsync("newOwnerReadPet");
        var newOwner = after.RequiredString("data.ownerUserId");
        Assert.NotEqual(originalOwner, newOwner);
        Assert.Equal(scenario.Setting("expectedNewOwnerId"), newOwner);
        var listing = await scenario.SendAsync("readListingPrivate");
        Assert.Equal("COMPLETED", listing.RequiredString("data.status"));
        var handovers = await scenario.SendAsync("readHandoverAudit");
        Assert.Equal(1, handovers.RequiredInt64("total"));
    }

    [Fact]
    public async Task DuplicateConfirmations_ReplayCannotTransferTwice()
    {
        using var scenario = ContractScenario.Open("adoption-idempotent-handover");
        var (first, second) = await scenario.SendConcurrentAsync("adopterConfirmA", "adopterConfirmB");
        Assert.All(new[] { first, second }, x => Assert.Contains(x.Status, new[] { 200, 201, 202, 409 }));
        Assert.True(new[] { first, second }.Any(x => x.Status is 200 or 201 or 202));
        var final = await scenario.SendAsync("readNewOwnerPet");
        Assert.Equal(scenario.Setting("expectedNewOwnerId"), final.RequiredString("data.ownerUserId"));
        var transfers = await scenario.SendAsync("readHandoverAudit");
        Assert.Equal(1, transfers.RequiredInt64("total"));
        var retry = await scenario.SendAsync("replaySameIdempotencyKey");
        Assert.Contains(retry.Status, new[] { 200, 201, 202, 409 });
        var stillOnce = await scenario.SendAsync("readHandoverAudit");
        Assert.Equal(1, stillOnce.RequiredInt64("total"));
    }

    [Fact]
    public async Task ForgedPetOrOwner_DeniedWithoutChangingOwnership()
    {
        using var scenario = ContractScenario.Open("adoption-forged-owner");
        var before = await scenario.SendAsync("legitimateOwnerReadPet");
        Assert.Equal(200, before.Status);
        var ownerId = before.RequiredString("data.ownerUserId");
        var rejected = await scenario.SendAsync("forgedHandover");
        Assert.Contains(rejected.Status, new[] { 403, 404 });
        var after = await scenario.SendAsync("legitimateOwnerReadPet");
        Assert.Equal(ownerId, after.RequiredString("data.ownerUserId"));
    }
}
