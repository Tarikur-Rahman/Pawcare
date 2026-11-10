using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Configuration;

namespace PawCare.Api.Infrastructure.Database;

/// <summary>
/// A small, Oracle-only convenience facade over the existing IOracleConnectionFactory
/// registered in Configuration/ServiceRegistration.cs. Do NOT register another
/// IOracleConnectionFactory implementation.
/// </summary>
public interface IPawCareDbConnectionFactory
{
    OracleConnection CreateClosedConnection();
    Task<OracleConnection> OpenConnectionAsync(CancellationToken cancellationToken = default);
}

public sealed class DbConnectionFactory : IPawCareDbConnectionFactory
{
    private readonly IOracleConnectionFactory _oracle;

    public DbConnectionFactory(IOracleConnectionFactory oracle)
    {
        _oracle = oracle ?? throw new ArgumentNullException(nameof(oracle));
    }

    public OracleConnection CreateClosedConnection() => _oracle.CreateConnection();

    /// <summary>
    /// The caller owns the connection and MUST dispose it (prefer await using).
    /// When OpenAsync fails, the connection is disposed before the error propagates.
    /// </summary>
    public async Task<OracleConnection> OpenConnectionAsync(
        CancellationToken cancellationToken = default)
    {
        var connection = CreateClosedConnection();
        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }
}
