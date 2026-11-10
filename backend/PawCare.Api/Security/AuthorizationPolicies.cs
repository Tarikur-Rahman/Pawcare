using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace PawCare.Api.Security;

/// <summary>
/// PawCare's three core DB roles. Seller / store-operator / beneficiary permissions
/// are revocable USER_CAPABILITIES rows, not extra role values and not static JWT grants.
/// These policies protect routes; OwnershipGuards protects individual resources.
/// </summary>
public static class AuthorizationPolicies
{
    public const string Authenticated = "Authenticated";
    public const string OwnerOnly = "OwnerOnly";
    public const string VetOnly = "VetOnly";
    public const string AdminOnly = "AdminOnly";

    public static void Configure(AuthorizationOptions policies)
    {
        ArgumentNullException.ThrowIfNull(policies);
        policies.AddPolicy(Authenticated, policy => policy.RequireAuthenticatedUser());
        policies.AddPolicy(OwnerOnly, policy => policy.RequireAuthenticatedUser().RequireRole("OWNER"));
        policies.AddPolicy(VetOnly, policy => policy.RequireAuthenticatedUser().RequireRole("VET"));
        policies.AddPolicy(AdminOnly, policy => policy.RequireAuthenticatedUser().RequireRole("ADMIN"));
    }

    /// <summary>
    /// Call once in Program.cs, IN PLACE OF the prior inline AddAuthorization block:
    /// builder.Services.AddPawCareSecurity();
    /// First call builder.Services.AddPawCareServices(...) from Configuration/ServiceRegistration.cs
    /// so TimeProvider and IOracleConnectionFactory are available.
    /// </summary>
    public static IServiceCollection AddPawCareSecurity(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddAuthorization(Configure);
        services.TryAddSingleton<IPawCarePasswordHasher, PasswordHasher>();
        services.TryAddSingleton<IJwtTokenService, JwtTokenService>();
        services.TryAddScoped<IOwnershipGuards, OwnershipGuards>();
        services.TryAddSingleton<TimeProvider>(TimeProvider.System);
        return services;
    }
}
