using System.Data;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Infrastructure.Database;

namespace PawCare.Api.Workers;

/// <summary>
/// Enqueues due, owner-scoped reminder EVENTS; it does not send push notifications.
/// OutboxWorker creates the in-app NOTIFICATIONS in a separate, atomic transaction.
/// Every reminder has a stable, unique dedupe_key in OUTBOX_EVENTS.
///
/// Recurring CARE_TASKS are expanded into concrete occurrences using the existing
/// unique occurrence_key; notification delivery remains an outbox concern.
/// </summary>
public sealed class ReminderWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<ReminderWorker> logger) : BackgroundService
{
    // The feature is opt-in until migration and runtime integration tests pass.
    private const string EnabledKey = "Workers:Reminders:Enabled";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue(EnabledKey, false))
        {
            logger.LogInformation("Reminder worker disabled by configuration.");
            return;
        }

        var pollSeconds = Math.Clamp(configuration.GetValue("Workers:Reminders:PollSeconds", 60), 15, 3600);
        var maxBatch = Math.Clamp(configuration.GetValue("Workers:Reminders:BatchSize", 100), 1, 200);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(pollSeconds));

        do
        {
            try
            {
                await RunOnceAsync(maxBatch, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Reminder polling failed; next cycle will retry.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    internal async Task<int> RunOnceAsync(int maxBatch, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var factory = scope.ServiceProvider.GetRequiredService<IPawCareDbConnectionFactory>();
        await MaterializeRecurringTasksAsync(factory, maxBatch, cancellationToken).ConfigureAwait(false);
        var reminders = new List<ReminderCandidate>();

        await using (var connection = await factory.OpenConnectionAsync(cancellationToken).ConfigureAwait(false))
        await using (var command = connection.CreateCommand())
        {
            command.BindByName = true;
            command.CommandTimeout = 20;
            // Care: 30 minutes ahead and up to 15 minutes late.
            // Appointments: confirmed appointments in the next 24 hours.
            // Vaccination: next due within 7 days, up to one day overdue;
            // skip superseded doses of the same vaccine.
            command.CommandText = """
                SELECT source_id, user_id, reminder_type
                  FROM (
                    SELECT source_id, user_id, reminder_type
                      FROM (
                        SELECT c.care_task_id source_id, p.owner_user_id user_id,
                               'CARE' reminder_type, c.due_at due_at
                          FROM CARE_TASKS c
                          JOIN PETS p ON p.pet_id = c.pet_id AND p.status = 'ACTIVE'
                          JOIN USERS u ON u.user_id = p.owner_user_id AND u.status = 'ACTIVE'
                         WHERE c.status = 'PENDING'
                           AND c.due_at >= SYSTIMESTAMP - NUMTODSINTERVAL(15, 'MINUTE')
                           AND c.due_at <= SYSTIMESTAMP + NUMTODSINTERVAL(30, 'MINUTE')
                           AND NOT EXISTS (
                               SELECT 1 FROM OUTBOX_EVENTS e
                                WHERE e.dedupe_key = 'REMINDER:CARE:' || TO_CHAR(c.care_task_id))
                        UNION ALL
                        SELECT a.appointment_id, p.owner_user_id,
                               'APPOINTMENT', a.starts_at
                          FROM APPOINTMENTS a
                          JOIN PETS p ON p.pet_id = a.pet_id AND p.status = 'ACTIVE'
                          JOIN USERS u ON u.user_id = p.owner_user_id AND u.status = 'ACTIVE'
                         WHERE a.status = 'CONFIRMED'
                           AND a.starts_at >= SYSTIMESTAMP
                           AND a.starts_at <= SYSTIMESTAMP + NUMTODSINTERVAL(24, 'HOUR')
                           AND NOT EXISTS (
                               SELECT 1 FROM OUTBOX_EVENTS e
                                WHERE e.dedupe_key = 'REMINDER:APPOINTMENT:' || TO_CHAR(a.appointment_id))
                        UNION ALL
                        SELECT v.vaccination_id, p.owner_user_id,
                               'VACCINATION', v.next_due_at
                          FROM VACCINATIONS v
                          JOIN PETS p ON p.pet_id = v.pet_id AND p.status = 'ACTIVE'
                          JOIN USERS u ON u.user_id = p.owner_user_id AND u.status = 'ACTIVE'
                         WHERE v.next_due_at IS NOT NULL
                           AND v.next_due_at >= SYSTIMESTAMP - NUMTODSINTERVAL(1, 'DAY')
                           AND v.next_due_at <= SYSTIMESTAMP + NUMTODSINTERVAL(7, 'DAY')
                           AND NOT EXISTS (
                               SELECT 1 FROM VACCINATIONS newer
                                WHERE newer.pet_id = v.pet_id
                                  AND UPPER(newer.vaccine_name) = UPPER(v.vaccine_name)
                                  AND newer.administered_at > v.administered_at)
                           AND NOT EXISTS (
                               SELECT 1 FROM OUTBOX_EVENTS e
                                WHERE e.dedupe_key = 'REMINDER:VACCINATION:' || TO_CHAR(v.vaccination_id))
                      ) candidates
                     ORDER BY due_at
                  )
                 WHERE ROWNUM <= :max_count
                """;
            command.Parameters.Add("max_count", OracleDbType.Int32).Value = maxBatch;
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                reminders.Add(new ReminderCandidate(reader.GetInt64(0), reader.GetInt64(1),
                    reader.GetString(2)));
            }
        }

        var queued = 0;
        foreach (var item in reminders)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await using var connection = await factory.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
            await using var command = connection.CreateCommand();
            command.BindByName = true;
            command.CommandTimeout = 15;
            command.CommandText = """
                INSERT INTO OUTBOX_EVENTS
                    (event_kind, aggregate_type, aggregate_id, payload_json, dedupe_key)
                VALUES
                    ('REMINDER_IN_APP', :aggregate_type, :aggregate_id, :payload, :dedupe_key)
                """;
            command.Parameters.Add("aggregate_type", OracleDbType.Varchar2).Value = item.Type;
            command.Parameters.Add("aggregate_id", OracleDbType.Varchar2).Value = item.SourceId.ToString(System.Globalization.CultureInfo.InvariantCulture);
            command.Parameters.Add("payload", OracleDbType.Clob).Value = JsonSerializer.Serialize(new
            {
                userId = item.UserId,
                reminderType = item.Type,
                sourceId = item.SourceId
            });
            command.Parameters.Add("dedupe_key", OracleDbType.Varchar2).Value =
                $"REMINDER:{item.Type}:{item.SourceId}";
            try
            {
                // The unique key is the cross-instance concurrency guard.
                queued += await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OracleException ex) when (ex.Number == 1) // ORA-00001
            {
                // Another worker won the race. Do not create a duplicate.
            }
        }

        if (queued > 0)
            logger.LogInformation("Enqueued {Count} reminder events.", queued);
        return queued;
    }

    private static async Task MaterializeRecurringTasksAsync(
        IPawCareDbConnectionFactory factory, int maxBatch, CancellationToken cancellationToken)
    {
        await using var connection = await factory.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
        await using var command = connection.CreateCommand();
        command.BindByName = true;
        command.CommandTimeout = 20;
        command.CommandText = """
            INSERT INTO CARE_TASKS
                (pet_id, task_type, title, due_at, recurrence_rule, occurrence_key,
                 time_zone, created_by_user_id)
            SELECT pet_id, task_type, title,
                   CASE recurrence_rule
                     WHEN 'DAILY' THEN due_at + NUMTODSINTERVAL(1,'DAY')
                     WHEN 'WEEKLY' THEN due_at + NUMTODSINTERVAL(7,'DAY')
                     WHEN 'MONTHLY' THEN ADD_MONTHS(due_at,1)
                   END,
                   recurrence_rule,
                   'RECURRENCE:' || TO_CHAR(care_task_id) || ':' ||
                     TO_CHAR(CAST(CASE recurrence_rule
                       WHEN 'DAILY' THEN due_at + NUMTODSINTERVAL(1,'DAY')
                       WHEN 'WEEKLY' THEN due_at + NUMTODSINTERVAL(7,'DAY')
                       WHEN 'MONTHLY' THEN ADD_MONTHS(due_at,1)
                     END AS TIMESTAMP), 'YYYYMMDDHH24MISSFF6'),
                   time_zone, created_by_user_id
              FROM CARE_TASKS source
             WHERE source.status='COMPLETED'
               AND source.recurrence_rule IN ('DAILY','WEEKLY','MONTHLY')
               AND source.due_at <= SYSTIMESTAMP
               AND ROWNUM <= :max_count
               AND NOT EXISTS (
                   SELECT 1 FROM CARE_TASKS next_task
                    WHERE next_task.occurrence_key =
                      'RECURRENCE:' || TO_CHAR(source.care_task_id) || ':' ||
                      TO_CHAR(CAST(CASE source.recurrence_rule
                        WHEN 'DAILY' THEN source.due_at + NUMTODSINTERVAL(1,'DAY')
                        WHEN 'WEEKLY' THEN source.due_at + NUMTODSINTERVAL(7,'DAY')
                        WHEN 'MONTHLY' THEN ADD_MONTHS(source.due_at,1)
                      END AS TIMESTAMP), 'YYYYMMDDHH24MISSFF6'))
            """;
        command.Parameters.Add("max_count", OracleDbType.Int32).Value = maxBatch;
        try
        {
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (OracleException ex) when (ex.Number == 1)
        {
            // A concurrent worker may win the unique occurrence_key race.
        }
    }

    private sealed record ReminderCandidate(long SourceId, long UserId, string Type);
}
