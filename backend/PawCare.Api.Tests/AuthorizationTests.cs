using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Common;
using PawCare.Api.Configuration;
using PawCare.Api.Security;
using Xunit;

namespace PawCare.Api.Tests;

public sealed class AuthorizationTests
{
    [Theory]
    [InlineData("OWNER", AuthorizationPolicies.OwnerOnly, true)]
    [InlineData("OWNER", AuthorizationPolicies.AdminOnly, false)]
    [InlineData("OWNER", AuthorizationPolicies.VetOnly, false)]
    [InlineData("VET", AuthorizationPolicies.VetOnly, true)]
    [InlineData("VET", AuthorizationPolicies.OwnerOnly, false)]
    [InlineData("ADMIN", AuthorizationPolicies.AdminOnly, true)]
    [InlineData("ADMIN", AuthorizationPolicies.VetOnly, false)]
    [InlineData("SELLER", AuthorizationPolicies.OwnerOnly, false)]
    public async Task PrimaryRolePolicy_IsStrictlyEnforced(string role, string policyName, bool expected)
    {
        using var provider = PolicyProvider();
        var authorization = provider.GetRequiredService<IAuthorizationService>();
        var verdict = await authorization.AuthorizeAsync(Principal(46, role), null, policyName);
        Assert.Equal(expected, verdict.Succeeded);
    }

    [Fact]
    public async Task UnauthenticatedPrincipal_IsDeniedForAllProtectedPolicies()
    {
        using var provider = PolicyProvider();
        var authorization = provider.GetRequiredService<IAuthorizationService>();
        var anonymous = new ClaimsPrincipal(new ClaimsIdentity());
        foreach (var policy in new[] { AuthorizationPolicies.Authenticated,
                     AuthorizationPolicies.OwnerOnly, AuthorizationPolicies.VetOnly, AuthorizationPolicies.AdminOnly })
            Assert.False((await authorization.AuthorizeAsync(anonymous, null, policy)).Succeeded);
    }

    [Fact]
    public async Task SellerClaim_WithoutDatabaseCapability_IsNotAnAdminOrVetOrOwnerRole()
    {
        using var provider = PolicyProvider();
        var service = provider.GetRequiredService<IAuthorizationService>();
        var fake = Principal(46, "SELLER");
        Assert.False((await service.AuthorizeAsync(fake, null, AuthorizationPolicies.OwnerOnly)).Succeeded);
        Assert.False((await service.AuthorizeAsync(fake, null, AuthorizationPolicies.AdminOnly)).Succeeded);
    }

    [Fact]
    public void AuthenticatedSubject_MustBeNumericAndPositive()
    {
        var guard = new OwnershipGuards(new NoDatabaseFactory());
        foreach (var subject in new[] { "", "0", "-1", "not-a-number", "92233720368547758070" })
        {
            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", subject),
                new Claim("role", "OWNER") }, "Test", "sub", "role"));
            var error = Assert.Throws<DomainException>(() => guard.RequireAuthenticatedUserId(principal));
            Assert.Equal(401, error.Error.HttpStatus);
        }
    }

    [Fact]
    public void UnauthenticatedClaims_MustNotGrantPetAccess()
    {
        var guard = new OwnershipGuards(new NoDatabaseFactory());
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", "46"), new Claim("role", "OWNER") }));
        Assert.Equal(401, Assert.Throws<DomainException>(() => guard.RequireOwner(principal, 46)).Error.HttpStatus);
    }

    [Fact]
    public void RequireOwner_AllowsMatchingPersistedOwner()
    {
        var guard = new OwnershipGuards(new NoDatabaseFactory());
        guard.RequireOwner(Principal(46, "OWNER"), 46);
    }

    [Theory]
    [InlineData(45)]
    [InlineData(0)]
    [InlineData(-1)]
    public void RequireOwner_HidesPrivateRecordsFromNonOwners(long persistedOwnerId)
    {
        var guard = new OwnershipGuards(new NoDatabaseFactory());
        var error = Assert.Throws<DomainException>(() => guard.RequireOwner(Principal(46, "OWNER"), persistedOwnerId));
        Assert.Equal("NOT_FOUND", error.Error.Code);
        Assert.Equal(404, error.Error.HttpStatus);
    }

    [Theory]
    [InlineData("VET", 46, true, true)]
    [InlineData("VET", 46, false, false)]
    [InlineData("VET", 47, true, false)]
    [InlineData("OWNER", 46, true, false)]
    [InlineData("ADMIN", 46, true, false)]
    public void AssignedVet_MustHaveRoleIdentityAssignmentAndConsent(
        string role, long assignedVetId, bool consentVerified, bool allowed)
    {
        var guard = new OwnershipGuards(new NoDatabaseFactory());
        if (allowed)
            guard.RequireAssignedVet(Principal(46, role), assignedVetId, consentVerified);
        else
            Assert.Equal(404, Assert.Throws<DomainException>(() =>
                guard.RequireAssignedVet(Principal(46, role), assignedVetId, consentVerified)).Error.HttpStatus);
    }

    // PC-AUTH-004. Real endpoint and persisted test pets; no in-memory ownership stubs.
    [Fact]
    public async Task Api_CrossOwnerReadAndEdit_RejectWithoutPrivateDisclosure()
    {
        using var scenario = ContractScenario.Open("authorization-cross-owner");
        var own = await scenario.SendAsync("ownerReadPet");
        Assert.Equal(200, own.Status);
        var ownerIdentity = own.RequiredString("data.ownerUserId");

        var read = await scenario.SendAsync("otherOwnerReadPet");
        var edit = await scenario.SendAsync("otherOwnerEditPet");
        Assert.Contains(read.Status, new[] { 403, 404 });
        Assert.Contains(edit.Status, new[] { 403, 404 });
        Assert.DoesNotContain(ownerIdentity, read.Body?.ToJsonString() ?? string.Empty, StringComparison.Ordinal);

        var unchanged = await scenario.SendAsync("ownerReadPet");
        Assert.Equal(200, unchanged.Status);
        Assert.Equal(own.RequiredString("data.name"), unchanged.RequiredString("data.name"));
        Assert.Equal(ownerIdentity, unchanged.RequiredString("data.ownerUserId"));
    }

    // PC-AUTH-006 / PC-SAFE-009. Capability must be read from current Oracle grant, not a stale token.
    [Fact]
    public async Task Api_RevokedSellerCapability_DeniesNewListingsImmediately()
    {
        using var scenario = ContractScenario.Open("authorization-revoked-seller");
        var revoked = await scenario.SendAsync("adminRevokeCapability");
        Assert.Contains(revoked.Status, new[] { 200, 204 });
        var denied = await scenario.SendAsync("sellerTryCreateListing");
        Assert.Equal(403, denied.Status);
    }

    private static ServiceProvider PolicyProvider()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorization(AuthorizationPolicies.Configure);
        return services.BuildServiceProvider();
    }

    private static ClaimsPrincipal Principal(long id, string role) =>
        new(new ClaimsIdentity(new[] { new Claim("sub", id.ToString()), new Claim("role", role) },
            "UnitTest", "sub", "role"));

    private sealed class NoDatabaseFactory : IOracleConnectionFactory
    {
        public OracleConnection CreateConnection() =>
            throw new InvalidOperationException("Pure authorization unit tests must not connect to Oracle.");
    }
}
