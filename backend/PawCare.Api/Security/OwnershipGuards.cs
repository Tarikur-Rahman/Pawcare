using System.Globalization;
using System.Security.Claims;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Common;
using PawCare.Api.Configuration;

namespace PawCare.Api.Security;

public interface IOwnershipGuards
{
    long RequireAuthenticatedUserId(ClaimsPrincipal principal);
    void RequireOwner(ClaimsPrincipal principal, long persistedOwnerUserId);
    void RequireAssignedVet(ClaimsPrincipal principal, long persistedVetUserId, bool consentAndAssignmentVerified);
    Task EnsurePetOwnerAsync(ClaimsPrincipal principal, long petId, CancellationToken cancellationToken = default);
    Task EnsureActiveCapabilityAsync(ClaimsPrincipal principal, string capability, CancellationToken cancellationToken = default);
}

/// <summary>
/// Resource checks must use IDs/relationships read from Oracle, never ownerId,
/// seller status, or consent booleans supplied by a mobile/web request.
/// Non-owners receive 404 to avoid revealing private pet/listing existence.
/// No implicit administrative access to private pet health records.
/// </summary>
public sealed class OwnershipGuards : IOwnershipGuards
{
    public const string ApprovedSeller = "APPROVED_SELLER";
    public const string StoreOperator = "STORE_OPERATOR";
    public const string VerifiedBeneficiary = "VERIFIED_BENEFICIARY";

    private readonly IOracleConnectionFactory _connections;

    public OwnershipGuards(IOracleConnectionFactory connections)
    {
        _connections = connections;
    }

    public long RequireAuthenticatedUserId(ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);
        if (principal.Identity?.IsAuthenticated != true ||
            !long.TryParse(principal.FindFirst("sub")?.Value,
                NumberStyles.None, CultureInfo.InvariantCulture, out var userId) ||
            userId <= 0)
        {
            throw new DomainException(DomainErrors.Unauthorized());
        }
        return userId;
    }

    public void RequireOwner(ClaimsPrincipal principal, long persistedOwnerUserId)
    {
        var userId = RequireAuthenticatedUserId(principal);
        if (persistedOwnerUserId <= 0 || userId != persistedOwnerUserId)
        {
            throw new DomainException(DomainErrors.NotFound());
        }
    }

    /// <summary>
    /// Only call after repository checks BOTH vet assignment and consent from
    /// trusted rows. The Boolean is not a substitute for reading those rows.
    /// </summary>
    public void RequireAssignedVet(
        ClaimsPrincipal principal, long persistedVetUserId, bool consentAndAssignmentVerified)
    {
        var userId = RequireAuthenticatedUserId(principal);
        if (!principal.IsInRole("VET") || persistedVetUserId <= 0 ||
            userId != persistedVetUserId || !consentAndAssignmentVerified)
        {
            throw new DomainException(DomainErrors.NotFound());
        }
    }

    /// <summary>
    /// Oracle ownership lookup rather than trusting a claimed owner ID.
    /// A missing pet and someone else's pet return the same 404.
    /// A transaction-sensitive write must repeat/lock this check in its transaction.
    /// </summary>
    public async Task EnsurePetOwnerAsync(
        ClaimsPrincipal principal, long petId, CancellationToken cancellationToken = default)
    {
        var callerId = RequireAuthenticatedUserId(principal);
        if (petId <= 0) throw new DomainException(DomainErrors.NotFound());

        await using var connection = _connections.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.BindByName = true;
        command.CommandText = """
            SELECT p.owner_user_id
              FROM pets p
              JOIN users u ON u.user_id = p.owner_user_id AND u.status = 'ACTIVE'
             WHERE p.pet_id = :pet_id
            """;
        command.Parameters.Add("pet_id", OracleDbType.Decimal).Value = petId;

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (!HasNumericValue(result, callerId))
        {
            throw new DomainException(DomainErrors.NotFound());
        }
    }

    /// <summary>
    /// Checks a current Oracle grant on EVERY privileged request. Expired/revoked
    /// grants cannot remain usable just because a 15-minute JWT is still valid.
    /// This check does not authorize any particular listing or order by itself.
    /// </summary>
    public async Task EnsureActiveCapabilityAsync(
        ClaimsPrincipal principal, string capability, CancellationToken cancellationToken = default)
    {
        var callerId = RequireAuthenticatedUserId(principal);
        if (capability is not (ApprovedSeller or StoreOperator or VerifiedBeneficiary))
        {
            throw new ArgumentException("Unsupported capability.", nameof(capability));
        }

        await using var connection = _connections.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.BindByName = true;
        command.CommandText = """
            SELECT COUNT(1)
              FROM user_capabilities c
              JOIN users u ON u.user_id = c.user_id AND u.status = 'ACTIVE'
             WHERE c.user_id = :user_id
               AND c.capability = :capability
               AND c.status = 'ACTIVE'
               AND c.revoked_at IS NULL
               AND (c.expires_at IS NULL OR c.expires_at > SYSTIMESTAMP)
            """;
        command.Parameters.Add("user_id", OracleDbType.Decimal).Value = callerId;
        command.Parameters.Add("capability", OracleDbType.Varchar2).Value = capability;

        var count = await command.ExecuteScalarAsync(cancellationToken);
        if (!HasPositiveNumericValue(count))
        {
            throw new DomainException(DomainErrors.Forbidden());
        }
    }
    private static bool HasNumericValue(object? value, long expected) =>
        long.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture),
            NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) && parsed == expected;

    private static bool HasPositiveNumericValue(object? value) =>
        long.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture),
            NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) && parsed > 0;
}
