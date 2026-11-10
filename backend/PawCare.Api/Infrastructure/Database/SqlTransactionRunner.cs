using System.Data;
using System.Data.Common;
using Oracle.ManagedDataAccess.Client;

namespace PawCare.Api.Infrastructure.Database;

/// <summary>
/// Runs one logical unit of Oracle DML on one connection and one transaction.
/// Do NOT use for schema migrations (Oracle DDL auto-commits). Do NOT retry a
/// transaction automatically: a timed-out commit may have reached the server.
/// </summary>
public interface ISqlTransactionRunner
{
    Task<TResult> RunAsync<TResult>(
        Func<OracleConnection, DbTransaction, CancellationToken, Task<TResult>> operation,
        CancellationToken cancellationToken = default,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted);
}

public sealed class SqlTransactionRunner : ISqlTransactionRunner
{
    private readonly IPawCareDbConnectionFactory _connections;

    public SqlTransactionRunner(IPawCareDbConnectionFactory connections)
    {
        _connections = connections ?? throw new ArgumentNullException(nameof(connections));
    }

    public async Task<TResult> RunAsync<TResult>(
        Func<OracleConnection, DbTransaction, CancellationToken, Task<TResult>> operation,
        CancellationToken cancellationToken = default,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted)
    {
        ArgumentNullException.ThrowIfNull(operation);
        if (isolationLevel != IsolationLevel.ReadCommitted)
        {
            throw new ArgumentOutOfRangeException(nameof(isolationLevel),
                "PawCare uses Oracle ReadCommitted transactions; serialize access with row locks as needed.");
        }

        await using var connection = await _connections.OpenConnectionAsync(cancellationToken)
            .ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(
            isolationLevel, cancellationToken).ConfigureAwait(false);

        try
        {
            var result = await operation(connection, transaction, cancellationToken)
                .ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return result;
        }
        catch
        {
            // Best-effort rollback even if the request was cancelled. A failed or
            // uncertain commit is NOT evidence that the operation did not occur.
            try
            {
                await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception)
            {
                // Preserve the original error; transaction disposal follows.
            }
            throw;
        }
    }
}
