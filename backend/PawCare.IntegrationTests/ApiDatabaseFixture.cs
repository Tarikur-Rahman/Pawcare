using System.Data.Common;
using Oracle.ManagedDataAccess.Client;

namespace PawCare.IntegrationTests;

/// <summary>
/// Explicitly opt-in access to an isolated Oracle test PDB. Never loads an
/// application or production connection string and never falls back to SQLite.
/// Callers own the returned open connection. This fixture intentionally issues
/// only SELECT statements plus SET TRANSACTION READ ONLY (no DML or DDL).
/// </summary>
public sealed class ApiDatabaseFixture
{
    public const string OptInValue = "I_ACCEPT_READ_ONLY_ORACLE_TESTS";

    public static bool IsEnabled =>
        string.Equals(Environment.GetEnvironmentVariable("PAWCARE_TEST_ORACLE_OPT_IN"),
            OptInValue, StringComparison.Ordinal);

    public static string MigrationDirectory =>
        Path.Combine(AppContext.BaseDirectory, "Migrations");

    public async Task<OracleConnection> OpenVerifiedAsync(CancellationToken ct = default)
    {
        if (!IsEnabled)
            throw new InvalidOperationException("Oracle integration tests are disabled. Set the explicit opt-in first.");

        var connectionString = Require("PAWCARE_TEST_ORACLE_CONNECTION");
        var expectedPdb = Require("PAWCARE_TEST_EXPECTED_PDB").ToUpperInvariant();
        var expectedSchema = Require("PAWCARE_TEST_EXPECTED_SCHEMA").ToUpperInvariant();

        if (expectedSchema != "PAWCARE_APP" || expectedPdb is "CDB$ROOT" or "PDB$SEED")
            throw new InvalidOperationException("Tests require the dedicated PAWCARE_APP schema in an explicit, non-root PDB.");

        // Do not log connection strings or passwords. Validate the target
        // identity before retrieving any application schema metadata.
        var connection = new OracleConnection(connectionString);
        try
        {
            await connection.OpenAsync(ct).ConfigureAwait(false);
            await using (var identity = connection.CreateCommand())
            {
                identity.CommandTimeout = 15;
                identity.CommandText = """
                    SELECT SYS_CONTEXT('USERENV','SESSION_USER'),
                           SYS_CONTEXT('USERENV','CURRENT_SCHEMA'),
                           SYS_CONTEXT('USERENV','CON_NAME')
                      FROM DUAL
                    """;
                await using var reader = await identity.ExecuteReaderAsync(ct).ConfigureAwait(false);
                if (!await reader.ReadAsync(ct).ConfigureAwait(false))
                    throw new InvalidOperationException("Cannot read Oracle session identity.");

                var sessionUser = Convert.ToString(reader.GetValue(0));
                var schema = Convert.ToString(reader.GetValue(1));
                var pdb = Convert.ToString(reader.GetValue(2));

                if (!string.Equals(sessionUser, expectedSchema, StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(schema, expectedSchema, StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(pdb, expectedPdb, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        "Oracle integration test schema/PDB mismatch. No schema tests were run.");
                }
            }

            // A read-only transaction protects from accidental DML inside
            // this session. Tests still must not issue DDL (which may commit).
            await using (var guard = connection.CreateCommand())
            {
                guard.CommandText = "SET TRANSACTION READ ONLY";
                await guard.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
            }
            return connection;
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>
    /// Executes a fixed, source-controlled SELECT and materializes results
    /// before the data reader and its command are disposed.
    /// </summary>
    public static async Task<IReadOnlyList<T>> SelectAsync<T>(
        OracleConnection connection,
        string trustedSelect,
        Func<DbDataReader, T> map,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        ArgumentNullException.ThrowIfNull(map);
        if (string.IsNullOrWhiteSpace(trustedSelect) ||
            !trustedSelect.TrimStart().StartsWith("SELECT ", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Only trusted SELECT statements are allowed.", nameof(trustedSelect));

        var rows = new List<T>();
        await using var command = connection.CreateCommand();
        command.BindByName = true;
        command.CommandTimeout = 30;
        command.InitialLONGFetchSize = -1;
        command.CommandText = trustedSelect;
        await using var reader = await command.ExecuteReaderAsync(ct).ConfigureAwait(false);
        while (await reader.ReadAsync(ct).ConfigureAwait(false))
            rows.Add(map(reader));
        return rows;
    }

    private static string Require(string name)
    {
        var value = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException($"Missing required integration-test variable: {name}");
        return value.Trim();
    }
}
