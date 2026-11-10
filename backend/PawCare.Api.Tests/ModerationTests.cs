using System.Text.Json.Nodes;
using PawCare.Api.Common;
using Xunit;

namespace PawCare.Api.Tests;

/// <summary>Safe error semantics plus real moderation, listing and public-redaction API contracts.</summary>
public sealed class ModerationTests
{
    [Fact]
    public void ForbiddenError_HasSafeGenericMessage()
    {
        var error = DomainErrors.Forbidden();
        Assert.Equal(403, error.HttpStatus);
        Assert.Equal("FORBIDDEN", error.Code);
        Assert.DoesNotContain("SQL", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void NonEnumeratingNotFound_DoesNotRevealPrivateResource()
    {
        var error = DomainErrors.NotFound();
        Assert.Equal(404, error.HttpStatus);
        Assert.Equal("NOT_FOUND", error.Code);
        Assert.DoesNotContain("owner", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("pet", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidationError_PreservesFieldCodesWithoutEchoingInput()
    {
        var errors = new ValidationBag();
        Validators.RequiredText("  ", "description", errors);
        var domainError = errors.ToDomainError();
        Assert.Equal(422, domainError.HttpStatus);
        Assert.Contains("description", domainError.FieldErrors.Keys);
        Assert.DoesNotContain("  ", domainError.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MarketplaceSeller_CannotApproveOwnListing()
    {
        using var scenario = ContractScenario.Open("moderation-no-self-approval");
        var attempt = await scenario.SendAsync("sellerTryApproveOwnListing");
        Assert.Contains(attempt.Status, new[] { 403, 404 });
        var publicResult = await scenario.SendAsync("anonymousReadListing");
        Assert.Equal(404, publicResult.Status);
        var ownerResult = await scenario.SendAsync("ownerReadListing");
        Assert.NotEqual("ACTIVE", ownerResult.RequiredString("data.status"));
    }

    [Fact]
    public async Task ModeratorRemoval_HidesListingButPreservesAuditEvidence()
    {
        using var scenario = ContractScenario.Open("moderation-removal");
        var before = await scenario.SendAsync("anonymousReadApprovedListing");
        Assert.Equal(200, before.Status);
        var removed = await scenario.SendAsync("moderatorRemoveListing");
        Assert.Contains(removed.Status, new[] { 200, 204 });
        var after = await scenario.SendAsync("anonymousReadApprovedListing");
        Assert.Equal(404, after.Status);
        var log = await scenario.SendAsync("moderatorReadAudit");
        Assert.Equal(200, log.Status);
        Assert.True(log.RequiredInt64("total") >= 1);
    }

    [Fact]
    public async Task LostFoundPublicView_RedactsExactLocationAndPrivateProof()
    {
        using var scenario = ContractScenario.Open("lost-found-public-redaction");
        var response = await scenario.SendAsync("anonymousReadLostPet");
        Assert.Equal(200, response.Status);
        Assert.NotNull(response.Body);
        AssertNoPrivateKeys(response.Body);
        Assert.False(string.IsNullOrWhiteSpace(response.RequiredString("data.generalArea")));
        var raw = response.Body!.ToJsonString();
        // These are unique sensitive sentinel values only present in the isolated fixture.
        Assert.DoesNotContain(scenario.Setting("privateEmailSentinel"), raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(scenario.Setting("exactAddressSentinel"), raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(scenario.Setting("privatePhoneSentinel"), raw, StringComparison.Ordinal);
    }

    private static void AssertNoPrivateKeys(JsonNode? node)
    {
        // Reject sensitive JSON property names anywhere inside the public projection.
        var forbidden = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "email", "phone", "phoneNumber", "ownerEmail", "ownerPhone", "mobileNumber",
            "exactAddress", "addressLine1", "addressLine2", "latitude", "longitude", "lat", "lng",
            "rawGps", "gpsCoordinates", "privateProof", "proofUrl", "proofMediaUrl", "exif"
        };
        if (node is JsonObject obj)
        {
            foreach (var pair in obj)
            {
                Assert.DoesNotContain(pair.Key, forbidden);
                AssertNoPrivateKeys(pair.Value);
            }
        }
        else if (node is JsonArray array)
        {
            foreach (var item in array) AssertNoPrivateKeys(item);
        }
    }
}
