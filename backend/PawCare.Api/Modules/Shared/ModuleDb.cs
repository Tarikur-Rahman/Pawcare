using System.Data;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Common;
using PawCare.Api.Infrastructure.Database;

namespace PawCare.Api.Modules.Shared;

/// <summary>Bound Oracle commands only. SQL is fixed application source, not caller supplied.</summary>
public sealed class ModuleDb(IPawCareDbConnectionFactory connections)
{
    public async Task<T> Transaction<T>(Func<OracleConnection, OracleTransaction, Task<T>> work, CancellationToken ct)
    {
        await using var connection = await connections.OpenConnectionAsync(ct);
        await using var transaction = (OracleTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        try
        {
            var result = await work(connection, transaction);
            await transaction.CommitAsync(ct);
            return result;
        }
        catch
        {
            try { await transaction.RollbackAsync(CancellationToken.None); }
            catch { /* retain original error; uncertain commit is not safe to retry blindly */ }
            throw;
        }
    }

    public async Task<List<Dictionary<string, object?>>> Query(string sql, (string Name, object? Value)[]? values = null,
        CancellationToken ct = default, OracleConnection? connection = null, OracleTransaction? transaction = null)
    {
        var owns = connection is null;
        if (owns) connection = await connections.OpenConnectionAsync(ct);
        try
        {
            using var command = Command(connection!, transaction, sql, values);
            await using var reader = await command.ExecuteReaderAsync(ct);
            var records = new List<Dictionary<string, object?>>();
            while (await reader.ReadAsync(ct))
            {
                var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                for (var col = 0; col < reader.FieldCount; col++)
                {
                    var value = reader.IsDBNull(col) ? null : reader.GetValue(col);
                    row[reader.GetName(col)] = value switch
                    {
                        DateTimeOffset dto => dto.ToUniversalTime().ToString("O",CultureInfo.InvariantCulture),
                        DateTime dt => dt.ToUniversalTime().ToString("O",CultureInfo.InvariantCulture),
                        decimal dec when dec == decimal.Truncate(dec) && dec is >= long.MinValue and <= long.MaxValue => (long)dec,
                        null => null,
                        // ODP.NET exposes proprietary timestamp objects in some provider versions.
                        Oracle.ManagedDataAccess.Types.OracleTimeStampTZ tz => tz.ToString(),
                        Oracle.ManagedDataAccess.Types.OracleTimeStampLTZ ltz => ltz.ToString(),
                        _ => value
                    };
                }
                records.Add(row);
            }
            return records;
        }
        finally { if (owns && connection is not null) await connection.DisposeAsync(); }
    }

    public async Task<Dictionary<string, object?>?> One(string sql, (string Name, object? Value)[]? values = null,
        CancellationToken ct = default, OracleConnection? connection = null, OracleTransaction? transaction = null) =>
        (await Query(sql, values, ct, connection, transaction)).FirstOrDefault();

    public async Task<object?> Scalar(string sql, (string Name, object? Value)[]? values = null,
        CancellationToken ct = default, OracleConnection? connection = null, OracleTransaction? transaction = null)
    {
        var owns = connection is null;
        if (owns) connection = await connections.OpenConnectionAsync(ct);
        try { using var command = Command(connection!, transaction, sql, values); return await command.ExecuteScalarAsync(ct); }
        finally { if (owns && connection is not null) await connection.DisposeAsync(); }
    }

    public async Task<int> Execute(string sql, (string Name, object? Value)[]? values = null,
        CancellationToken ct = default, OracleConnection? connection = null, OracleTransaction? transaction = null)
    {
        var owns = connection is null;
        if (owns) connection = await connections.OpenConnectionAsync(ct);
        try { using var command = Command(connection!, transaction, sql, values); return await command.ExecuteNonQueryAsync(ct); }
        finally { if (owns && connection is not null) await connection.DisposeAsync(); }
    }

    public async Task<long> InsertId(string tableSql, (string Name, object? Value)[]? values, string pk,
        CancellationToken ct, OracleConnection? connection = null, OracleTransaction? transaction = null)
    {
        var owns = connection is null;
        if (owns) connection = await connections.OpenConnectionAsync(ct);
        try
        {
            using var command = Command(connection!, transaction, tableSql + $" RETURNING {pk} INTO :out_id", values);
            var output = command.Parameters.Add("out_id", OracleDbType.Decimal);
            output.Direction = ParameterDirection.Output;
            await command.ExecuteNonQueryAsync(ct);
            return Convert.ToInt64(output.Value.ToString(), CultureInfo.InvariantCulture);
        }
        finally { if (owns && connection is not null) await connection.DisposeAsync(); }
    }

    private static OracleCommand Command(OracleConnection connection, OracleTransaction? transaction,
        string sql, (string Name, object? Value)[]? values)
    {
        var command = connection.CreateCommand();
        command.CommandText = sql;
        command.BindByName = true;
        command.CommandTimeout = 15;
        if (transaction is not null) command.Transaction = transaction;
        if (values is null) return command;
        foreach (var (key, val) in values)
        {
            if (string.IsNullOrWhiteSpace(key) || !key.All(c => char.IsAsciiLetterOrDigit(c) || c == '_'))
                throw new ArgumentException("Invalid bind name.");
            var p = command.Parameters.Add(key, val switch
            {
                long or int => OracleDbType.Int64,
                DateTimeOffset => OracleDbType.TimeStampTZ,
                DateTime => OracleDbType.Date,
                decimal => OracleDbType.Decimal,
                byte[] => OracleDbType.Blob,
                _ => OracleDbType.Varchar2
            });
            p.Value = val ?? DBNull.Value;
        }
        return command;
    }
}

public static class ModuleRules
{
    public static long UserId(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true ||
            !long.TryParse(principal.FindFirst("sub")?.Value, out var userId) || userId <= 0)
            throw new DomainException(DomainErrors.Unauthorized());
        return userId;
    }
    public static void Check(bool ok, string field = "request", string message = "Invalid input.")
    {
        if (!ok) throw new DomainException(DomainErrors.ValidationFailed(
            new Dictionary<string, string[]> { [field] = [message] }));
    }
    public static string Text(string? input, int max, string field, int min = 1)
    {
        Check(input is not null && input.Trim().Length >= min && Encoding.UTF8.GetByteCount(input.Trim()) <= max,
            field, $"{field} must contain {min} to {max} UTF-8 bytes.");
        return input!.Trim();
    }
    public static void Found([DoesNotReturnIf(false)] bool ok) { if (!ok) throw new DomainException(DomainErrors.NotFound()); }
    public static void Conflict(bool ok, string message = "The resource has changed or is no longer available.")
    { if (!ok) throw new DomainException(DomainErrors.Conflict(message: message)); }
    public static long Id(Dictionary<string, object?> record, string key) => Convert.ToInt64(record[key], CultureInfo.InvariantCulture);
    public static string Str(Dictionary<string, object?> record, string key) => Convert.ToString(record[key], CultureInfo.InvariantCulture) ?? "";
    public static (string Name, object? Value)[] P(params (string Name, object? Value)[] values) => values;
    public static string Hash(string raw) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    public static Pagination Page(HttpContext ctx)
    {
        if (!Pagination.TryParse(ctx.Request.Query["page"], ctx.Request.Query["pageSize"],
            out var page, out var error)) throw new DomainException(error!);
        return page!;
    }
    public static long Positive(long value, string field) { Check(value > 0, field); return value; }
    public static IResult Disabled(HttpContext ctx, string code, string description) =>
        ApiResponses.Error(ctx, new DomainError(code, description, StatusCodes.Status503ServiceUnavailable));
}
