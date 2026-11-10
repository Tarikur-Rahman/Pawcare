using System.Data;
using System.Data.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Infrastructure.Database;

namespace PawCare.Api.Workers;

/// <summary>
/// Safely expires stock reservations associated with unpaid PLACED food orders.
/// Lock sequence: ORDERS -> ORDER_STOCK_RESERVATIONS -> INVENTORY_STOCK.
/// If any reserved line expires, cancel that unpaid order and release ALL its
/// remaining reserved lines in one Oracle transaction. Paid/shipped orders
/// are never automatically cancelled or released.
///
/// Periodically reports mismatches between INVENTORY_STOCK.reserved_qty and
/// the sum of RESERVED rows without trying to overwrite either source.
/// The API checkout/payment handlers must follow the same lock order.
/// </summary>
public sealed class InventoryReconcileWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<InventoryReconcileWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Workers:Inventory:Enabled", false))
        {
            logger.LogInformation("Inventory reconciliation worker disabled by configuration.");
            return;
        }

        var interval = TimeSpan.FromSeconds(
            Math.Clamp(configuration.GetValue("Workers:Inventory:PollSeconds", 120), 30, 3600));
        var batchSize = Math.Clamp(configuration.GetValue("Workers:Inventory:BatchSize", 25), 1, 100);
        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                await RunOnceAsync(batchSize, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Inventory reconciliation failed; next cycle will retry.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    internal async Task<int> RunOnceAsync(int maxBatch, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var connections = scope.ServiceProvider.GetRequiredService<IPawCareDbConnectionFactory>();
        var expiredOrderIds = new List<long>();
        await using (var connection = await connections.OpenConnectionAsync(cancellationToken).ConfigureAwait(false))
        await using (var find = connection.CreateCommand())
        {
            find.BindByName = true;
            find.CommandTimeout = 20;
            // Select only unpaid orders. The status is rechecked under an
            // exclusive row lock before making any stock change.
            find.CommandText = """
                SELECT order_id FROM (
                    SELECT DISTINCT r.order_id
                      FROM ORDER_STOCK_RESERVATIONS r
                      JOIN ORDERS o ON o.order_id=r.order_id
                     WHERE r.state='RESERVED' AND r.expires_at<=SYSTIMESTAMP
                       AND o.status='PLACED'
                       AND NOT EXISTS (
                           SELECT 1 FROM PAYMENTS pay
                            WHERE pay.order_id=o.order_id
                              AND pay.state IN ('PENDING','AUTHORIZED','CAPTURED'))
                     ORDER BY r.order_id
                ) WHERE ROWNUM <= :max_count
                """;
            find.Parameters.Add("max_count", OracleDbType.Int32).Value = maxBatch;
            await using var reader = await find.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                expiredOrderIds.Add(reader.GetInt64(0));
        }

        var cancelled = 0;
        foreach (var id in expiredOrderIds)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                if (await ExpireOrderAsync(connections, id, cancellationToken).ConfigureAwait(false))
                    cancelled++;
            }
            catch (OracleException ex) when (ex.Number is 54 or 60 or 30006)
            {
                // Lock timeout/deadlock: rollback and let the next cycle retry.
                logger.LogWarning("Inventory order {OrderId} currently locked; deferring.", id);
            }
        }

        await ReportInconsistencyCountAsync(connections, cancellationToken).ConfigureAwait(false);
        if (cancelled > 0)
            logger.LogInformation("Expired reservations and cancelled {Count} unpaid food orders.", cancelled);
        return cancelled;
    }

    private static async Task<bool> ExpireOrderAsync(
        IPawCareDbConnectionFactory connections, long orderId, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = await connection.BeginTransactionAsync(
            IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        try
        {
            string? status;
            await using (var lockedOrder = NewCommand(connection, transaction, """
                SELECT status FROM ORDERS WHERE order_id=:id FOR UPDATE WAIT 2
                """))
            {
                lockedOrder.Parameters.Add("id", OracleDbType.Int64).Value = orderId;
                status = await lockedOrder.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) as string;
            }
            if (status != "PLACED")
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return false;
            }

            // Do not release stock while a provider may still be processing
            // payment. The payment handler must lock ORDERS before changing
            // PAYMENTS or the order status to close any remaining race.
            await using (var paymentGuard = NewCommand(connection, transaction, """
                SELECT COUNT(*) FROM PAYMENTS
                 WHERE order_id=:order_id AND state IN ('PENDING','AUTHORIZED','CAPTURED')
                """))
            {
                paymentGuard.Parameters.Add("order_id", OracleDbType.Int64).Value = orderId;
                var inFlight = Convert.ToInt32(
                    await paymentGuard.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false));
                if (inFlight > 0)
                {
                    await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                    return false;
                }
            }

            var lines = new List<ReservedLine>();
            await using (var lockedLines = NewCommand(connection, transaction, """
                SELECT reservation_id, product_id, quantity,
                       CASE WHEN expires_at<=SYSTIMESTAMP THEN 1 ELSE 0 END AS expired
                  FROM ORDER_STOCK_RESERVATIONS
                 WHERE order_id=:order_id AND state='RESERVED'
                 ORDER BY product_id, reservation_id
                 FOR UPDATE WAIT 2
                """))
            {
                lockedLines.Parameters.Add("order_id", OracleDbType.Int64).Value = orderId;
                await using var reader = await lockedLines.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
                while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                    lines.Add(new ReservedLine(reader.GetInt64(0), reader.GetInt64(1),
                        reader.GetInt32(2), reader.GetInt32(3) == 1));
            }
            if (lines.Count == 0 || !lines.Any(line => line.Expired))
            {
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return false;
            }

            // Release each reserved product at most once, using a conditional
            // update so data corruption fails the transaction instead of going
            // negative. No INVENTORY_MOVEMENTS row is appropriate: on-hand stock
            // did not change; only the reservation is removed.
            foreach (var line in lines)
            {
                await using (var decrement = NewCommand(connection, transaction, """
                    UPDATE INVENTORY_STOCK
                       SET reserved_qty=reserved_qty-:quantity
                     WHERE product_id=:product_id AND reserved_qty>=:quantity
                    """))
                {
                    decrement.Parameters.Add("quantity", OracleDbType.Int32).Value = line.Quantity;
                    decrement.Parameters.Add("product_id", OracleDbType.Int64).Value = line.ProductId;
                    if (await decrement.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
                        throw new InvalidOperationException("Reservation and stock counters disagree.");
                }

                await using var release = NewCommand(connection, transaction, """
                    UPDATE ORDER_STOCK_RESERVATIONS
                       SET state='EXPIRED', closed_at=SYSTIMESTAMP
                     WHERE reservation_id=:reservation_id AND state='RESERVED'
                    """);
                release.Parameters.Add("reservation_id", OracleDbType.Int64).Value = line.ReservationId;
                if (await release.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
                    throw new InvalidOperationException("Reservation changed during release.");
            }

            await using (var cancelOrder = NewCommand(connection, transaction, """
                UPDATE ORDERS SET status='CANCELLED'
                 WHERE order_id=:order_id AND status='PLACED'
                """))
            {
                cancelOrder.Parameters.Add("order_id", OracleDbType.Int64).Value = orderId;
                if (await cancelOrder.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
                    throw new InvalidOperationException("Order status changed during expiry.");
            }
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch
        {
            try { await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false); }
            catch { /* preserve the original error */ }
            throw;
        }
    }

    private async Task ReportInconsistencyCountAsync(
        IPawCareDbConnectionFactory connections, CancellationToken cancellationToken)
    {
        await using var connection = await connections.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.CommandTimeout = 30;
        command.CommandText = """
            SELECT COUNT(*) FROM (
                SELECT s.product_id
                  FROM INVENTORY_STOCK s
                  LEFT JOIN (
                      SELECT product_id, SUM(quantity) as total_reserved
                        FROM ORDER_STOCK_RESERVATIONS
                       WHERE state='RESERVED'
                       GROUP BY product_id
                  ) r ON r.product_id=s.product_id
                 WHERE s.reserved_qty <> NVL(r.total_reserved,0)
            )
            """;
        var mismatchCount = Convert.ToInt32(
            await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false));
        if (mismatchCount > 0)
            logger.LogWarning("Inventory reservation reconciliation detected {Count} mismatched products; no automatic correction made.",
                mismatchCount);
    }

    private static OracleCommand NewCommand(
        OracleConnection connection, DbTransaction transaction, string sql)
    {
        var command = connection.CreateCommand();
        command.Transaction = (OracleTransaction)transaction;
        command.BindByName = true;
        command.CommandTimeout = 20;
        command.CommandText = sql;
        return command;
    }

    private sealed record ReservedLine(long ReservationId, long ProductId, int Quantity, bool Expired);
}
