using System.Data;
using System.Data.Common;
using System.Text.RegularExpressions;
using Oracle.ManagedDataAccess.Client;

namespace PawCare.Api.Infrastructure.Database;

/// <summary>
/// Safe Oracle bind-parameter helpers for SQL authored by trusted backend code.
/// SQL text (including table/column names, ORDER BY, etc.) must NEVER be
/// constructed from untrusted input; bind parameters protect values only.
/// </summary>
public static class ParameterizedSql
{
    private static readonly Regex ParameterNamePattern = new(
        "^[A-Za-z][A-Za-z0-9_]{0,127}$", RegexOptions.CultureInvariant);

    public static OracleCommand Create(
        OracleConnection connection,
        string sql,
        DbTransaction? transaction = null,
        int timeoutSeconds = 30)
    {
        ArgumentNullException.ThrowIfNull(connection);
        if (string.IsNullOrWhiteSpace(sql))
            throw new ArgumentException("Trusted SQL text is required.", nameof(sql));
        if (timeoutSeconds is < 1 or > 300)
            throw new ArgumentOutOfRangeException(nameof(timeoutSeconds));

        if (transaction is not null && transaction is not OracleTransaction)
            throw new ArgumentException("Oracle commands require an Oracle transaction.", nameof(transaction));

        var command = connection.CreateCommand();
        command.BindByName = true; // Never bind values by position.
        command.CommandType = CommandType.Text;
        command.CommandTimeout = timeoutSeconds;
        command.CommandText = sql;
        if (transaction is OracleTransaction oracleTransaction)
            command.Transaction = oracleTransaction;
        return command;
    }

    /// <summary>
    /// Names are provided without a leading colon. Use :name in SQL, then bind
    /// via Add(command, "name", OracleDbType.Varchar2, value, size: 100).
    /// </summary>
    public static OracleCommand Add(
        OracleCommand command,
        string name,
        OracleDbType databaseType,
        object? value,
        int? size = null,
        ParameterDirection direction = ParameterDirection.Input)
    {
        ArgumentNullException.ThrowIfNull(command);
        if (name is null || !ParameterNamePattern.IsMatch(name))
            throw new ArgumentException("Invalid Oracle bind parameter name.", nameof(name));
        if (command.Parameters.Contains(name))
            throw new ArgumentException($"Duplicate Oracle bind parameter: {name}.", nameof(name));
        if (size is <= 0)
            throw new ArgumentOutOfRangeException(nameof(size));
        if (direction != ParameterDirection.Input)
            throw new ArgumentException("Use input bind parameters for application queries.", nameof(direction));

        var parameter = command.Parameters.Add(name, databaseType);
        parameter.Direction = direction;
        if (size.HasValue) parameter.Size = size.Value;
        parameter.Value = value ?? DBNull.Value;
        return command;
    }

    public static OracleCommand AddId(OracleCommand command, string name, long value)
    {
        if (value <= 0) throw new ArgumentOutOfRangeException(nameof(value));
        return Add(command, name, OracleDbType.Int64, value);
    }

    public static OracleCommand AddText(OracleCommand command, string name, string? value, int maxBytes)
    {
        if (maxBytes is < 1 or > 4000) throw new ArgumentOutOfRangeException(nameof(maxBytes));
        if (value is not null && System.Text.Encoding.UTF8.GetByteCount(value) > maxBytes)
            throw new ArgumentException("Text exceeds the configured byte limit.", nameof(value));
        return Add(command, name, OracleDbType.Varchar2, value, size: maxBytes);
    }

    public static OracleCommand AddMoneyMinor(OracleCommand command, string name, long minorUnits)
    {
        if (minorUnits < 0) throw new ArgumentOutOfRangeException(nameof(minorUnits));
        return Add(command, name, OracleDbType.Int64, minorUnits);
    }

    public static OracleCommand AddTimestamp(OracleCommand command, string name, DateTimeOffset? timestamp)
        => Add(command, name, OracleDbType.TimeStampTZ, timestamp?.ToUniversalTime());
}
