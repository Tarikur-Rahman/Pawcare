using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Oracle.ManagedDataAccess.Client;

namespace PawCare.Api.Infrastructure.Database;

public sealed record MigrationEntry(string Version, string FileName, string ChecksumSha256);

public sealed record MigrationVerification(
    bool IsReady,
    IReadOnlyList<string> Applied,
    IReadOnlyList<string> Pending,
    IReadOnlyList<string> Issues);

/// <summary>
/// Audits the existing, immutable SQL*Plus/SQLcl migrations V001–V014 against
/// Oracle's SCHEMA_MIGRATIONS ledger. Deliberately does not execute DDL:
/// these files contain SQL*Plus commands/PLSQL blocks and Oracle DDL commits
/// implicitly. Apply them in order with an authorized operator, then verify.
/// Never invoke this from a public HTTP endpoint.
/// </summary>
public sealed class MigrationRunner
{
    private const int FirstVersion = 1;
    private const int LastVersion = 14;

    private static readonly Regex LedgerInsert = new(
        @"\(\s*'(?<version>V\d{3})'\s*,\s*'[^']+'\s*,\s*'ORACLE'\s*,\s*'(?<hash>[0-9a-f]{64})'\s*(?:,\s*[^)]*)?\)",
        RegexOptions.CultureInvariant | RegexOptions.Singleline | RegexOptions.IgnoreCase);

    private readonly IPawCareDbConnectionFactory _connections;

    public MigrationRunner(IPawCareDbConnectionFactory connections)
    {
        _connections = connections ?? throw new ArgumentNullException(nameof(connections));
    }

    /// <summary>
    /// Validates the local immutable files, including the SHA-256 embedded in
    /// each script. Convert line endings to LF before hashing, as required by
    /// the checked-in Oracle migration definitions.
    /// </summary>
    public static async Task<IReadOnlyList<MigrationEntry>> ReadManifestAsync(
        string migrationsDirectory,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(migrationsDirectory))
            throw new ArgumentException("The Oracle migrations directory is required.", nameof(migrationsDirectory));
        var directory = Path.GetFullPath(migrationsDirectory);
        if (!Directory.Exists(directory))
            throw new DirectoryNotFoundException("The Oracle migration directory does not exist.");

        var result = new List<MigrationEntry>(LastVersion);
        for (var number = FirstVersion; number <= LastVersion; number++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var version = $"V{number:000}";
            var files = Directory.GetFiles(directory, version + "_*.sql", SearchOption.TopDirectoryOnly);
            if (files.Length != 1)
                throw new InvalidOperationException($"Expected one immutable {version} Oracle migration file.");

            var source = (await File.ReadAllTextAsync(files[0], cancellationToken).ConfigureAwait(false))
                .Replace("\r\n", "\n", StringComparison.Ordinal)
                .Replace("\r", "\n", StringComparison.Ordinal);
            var beginMarker = $"-- BEGIN {version} DDL (checksum scope starts after this line)";
            var endMarker = $"-- END {version} DDL (checksum scope ends before this line)";
            var beginIndex = source.IndexOf(beginMarker, StringComparison.Ordinal);
            var endIndex = source.IndexOf(endMarker, StringComparison.Ordinal);
            if (beginIndex < 0 || endIndex <= beginIndex ||
                source.LastIndexOf(beginMarker, StringComparison.Ordinal) != beginIndex ||
                source.LastIndexOf(endMarker, StringComparison.Ordinal) != endIndex)
            {
                throw new InvalidOperationException($"{version} has missing or duplicate checksum markers.");
            }

            var startOfDdl = source.IndexOf('\n', beginIndex + beginMarker.Length);
            if (startOfDdl < 0 || startOfDdl + 1 > endIndex)
                throw new InvalidOperationException($"{version} has malformed DDL checksum markers.");
            var ddl = source[(startOfDdl + 1)..endIndex];
            var actualHash = Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(ddl))).ToLowerInvariant();

            var matches = LedgerInsert.Matches(source);
            if (matches.Count != 1 ||
                !string.Equals(matches[0].Groups["version"].Value, version,
                    StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(matches[0].Groups["hash"].Value, actualHash,
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"{version} file or recorded SHA-256 is inconsistent. Do not apply it.");
            }
            result.Add(new MigrationEntry(version, Path.GetFileName(files[0]), actualHash));
        }
        return result.AsReadOnly();
    }

    /// <summary>
    /// Read-only database audit. Requires SELECT permission on SCHEMA_MIGRATIONS
    /// (normally as PAWCARE_APP during initialization). A missing/unreadable ledger
    /// is reported as an error, not mistaken for a clean database.
    /// </summary>
    public async Task<MigrationVerification> VerifyAsync(
        string migrationsDirectory,
        CancellationToken cancellationToken = default)
    {
        var expected = await ReadManifestAsync(migrationsDirectory, cancellationToken)
            .ConfigureAwait(false);
        var expectedByVersion = expected.ToDictionary(x => x.Version, StringComparer.Ordinal);
        var actualByVersion = new Dictionary<string, string>(StringComparer.Ordinal);
        var issues = new List<string>();

        await using var connection = await _connections.OpenConnectionAsync(cancellationToken)
            .ConfigureAwait(false);
        await using var command = ParameterizedSql.Create(connection, """
            SELECT migration_version, checksum_sha256
              FROM SCHEMA_MIGRATIONS
             WHERE provider = :provider
            """);
        ParameterizedSql.AddText(command, "provider", "ORACLE", 16);
        try
        {
            await using var reader = await command.ExecuteReaderAsync(cancellationToken)
                .ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                var version = reader.GetString(0);
                var checksum = reader.GetString(1).Trim();
                if (!actualByVersion.TryAdd(version, checksum))
                    issues.Add($"Duplicate ledger entry for {version}.");
            }
        }
        catch (OracleException exception) when (exception.Number == 942)
        {
            // A partially initialized DB must not be treated as having 0 safe migrations.
            return new MigrationVerification(false, Array.Empty<string>(),
                expected.Select(x => x.Version).ToArray(),
                new[] { "SCHEMA_MIGRATIONS is missing or the Oracle user lacks SELECT permission." });
        }

        var pending = new List<string>();
        var applied = new List<string>();
        foreach (var migration in expected)
        {
            if (!actualByVersion.TryGetValue(migration.Version, out var storedHash))
            {
                pending.Add(migration.Version);
                continue;
            }
            applied.Add(migration.Version);
            if (!string.Equals(storedHash, migration.ChecksumSha256, StringComparison.Ordinal))
                issues.Add($"SHA-256 mismatch for {migration.Version}; investigate migration drift.");
        }
        foreach (var extra in actualByVersion.Keys.Except(expectedByVersion.Keys, StringComparer.Ordinal))
            issues.Add($"Unexpected Oracle migration {extra} is present.");

        // Partial histories with gaps must be investigated rather than replayed blindly.
        if (pending.Count > 0 && applied.Count > 0 &&
            applied.Any(x => string.CompareOrdinal(x, pending[0]) > 0))
            issues.Add("Migration history has a gap; inspect the database before taking action.");

        return new MigrationVerification(pending.Count == 0 && issues.Count == 0,
            applied.AsReadOnly(), pending.AsReadOnly(), issues.AsReadOnly());
    }
}
