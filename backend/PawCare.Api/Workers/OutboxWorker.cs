using System.Data;
using System.Data.Common;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Infrastructure.Database;
using PawCare.Api.Infrastructure.Email;

namespace PawCare.Api.Workers;

/// <summary>
/// Oracle transactional outbox consumer for V012 OUTBOX_EVENTS.
/// Handles REMINDER_IN_APP atomically (notification INSERT + SENT status).
/// Optionally handles EMAIL_NOTIFICATION after the application has recorded
/// affirmative email consent. Other event kinds remain PENDING for their future
/// dedicated consumers; they are not silently acknowledged or dead-lettered.
///
/// The schema has no claim-time/lease columns. Therefore each event row remains
/// locked (FOR UPDATE SKIP LOCKED) until the handler commits. This prevents
/// concurrent consumers from handling the same row, but SMTP remains at-least-once
/// if the provider accepts a message and the Oracle commit subsequently fails.
/// </summary>
public sealed class OutboxWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<OutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Workers:Outbox:Enabled", false))
        {
            logger.LogInformation("Outbox worker disabled by configuration.");
            return;
        }

        var pollSeconds = Math.Clamp(configuration.GetValue("Workers:Outbox:PollSeconds", 10), 2, 600);
        var batchSize = Math.Clamp(configuration.GetValue("Workers:Outbox:BatchSize", 25), 1, 100);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(pollSeconds));
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
                logger.LogError(ex, "Outbox polling failed; next cycle will retry.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    internal async Task<int> RunOnceAsync(int maxBatch, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var connections = scope.ServiceProvider.GetRequiredService<IPawCareDbConnectionFactory>();
        var includeEmail = configuration.GetValue("Workers:Outbox:EmailEnabled", false);
        var processed = 0;
        for (var count = 0; count < maxBatch; count++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await using var connection = await connections.OpenConnectionAsync(cancellationToken).ConfigureAwait(false);
            OutboxItem? evt = null;
            Exception? dispatchFailure = null;
            await using (var transaction = await connection.BeginTransactionAsync(
                IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false))
            {
                try
                {
                    evt = await LockNextEventAsync(connection, transaction, includeEmail, cancellationToken)
                        .ConfigureAwait(false);
                    if (evt is null)
                    {
                        await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                        break;
                    }

                    switch (evt.Kind)
                    {
                        case "REMINDER_IN_APP":
                            await ProcessInAppReminderAsync(connection, transaction, evt.Payload, cancellationToken)
                                .ConfigureAwait(false);
                            break;
                        case "EMAIL_NOTIFICATION" when includeEmail:
                            await SendNotificationEmailAsync(connection, transaction, evt.Payload,
                                scope.ServiceProvider.GetRequiredService<IEmailGateway>(), cancellationToken)
                                .ConfigureAwait(false);
                            break;
                        default:
                            throw new NotSupportedException("Unrecognized dispatch type.");
                    }

                    await using var completed = NewCommand(connection, transaction, """
                        UPDATE OUTBOX_EVENTS
                           SET status='SENT', processed_at=SYSTIMESTAMP,
                               last_error_code=NULL
                         WHERE event_id=:id AND status='PENDING'
                        """);
                    completed.Parameters.Add("id", OracleDbType.Int64).Value = evt.Id;
                    if (await completed.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
                        throw new InvalidOperationException("Outbox state changed unexpectedly.");
                    await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                    processed++;
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    try { await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false); }
                    catch { /* Preserve cancellation. */ }
                    throw;
                }
                catch (Exception ex)
                {
                    // Crucial: rollback a partial NOTIFICATIONS INSERT BEFORE
                    // writing retry metadata. Do not commit a partial dispatch.
                    try { await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false); }
                    catch { /* Preserve dispatch failure; next poll can recover. */ }
                    dispatchFailure = ex;
                }
            }

            if (dispatchFailure is not null)
            {
                // The event could have been delivered to SMTP before a failed
                // commit; an external email can be resent. We cannot guarantee
                // exactly-once SMTP delivery without provider-level idempotency.
                if (evt is null) throw dispatchFailure;
                var attempts = evt.RetryCount + 1;
                var maxAttempts = Math.Clamp(configuration.GetValue("Workers:Outbox:MaxAttempts", 7), 1, 20);
                var retrySeconds = Math.Min(3600, 30 * (1 << Math.Min(attempts - 1, 7)));
                await using var retryTx = await connection.BeginTransactionAsync(
                    IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
                try
                {
                    await using var failed = NewCommand(connection, retryTx, """
                        UPDATE OUTBOX_EVENTS
                           SET status=:state, retry_count=retry_count+1,
                               next_attempt_at=SYSTIMESTAMP + NUMTODSINTERVAL(:delay_seconds,'SECOND'),
                               last_error_code=:code
                         WHERE event_id=:id AND status='PENDING' AND retry_count=:old_count
                        """);
                    failed.Parameters.Add("state", OracleDbType.Varchar2).Value =
                        attempts >= maxAttempts ? "DEAD" : "PENDING";
                    failed.Parameters.Add("delay_seconds", OracleDbType.Int32).Value = retrySeconds;
                    failed.Parameters.Add("code", OracleDbType.Varchar2).Value = dispatchFailure.GetType().Name;
                    failed.Parameters.Add("id", OracleDbType.Int64).Value = evt.Id;
                    failed.Parameters.Add("old_count", OracleDbType.Int32).Value = evt.RetryCount;
                    var changed = await failed.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
                    await retryTx.CommitAsync(cancellationToken).ConfigureAwait(false);
                    if (changed == 1)
                        logger.LogWarning("Outbox event {EventId} failed; attempt {Attempt}/{MaxAttempts}; type {ErrorType}.",
                            evt.Id, attempts, maxAttempts, dispatchFailure.GetType().Name);
                }
                catch
                {
                    try { await retryTx.RollbackAsync(CancellationToken.None).ConfigureAwait(false); }
                    catch { /* Preserve primary failure. */ }
                    throw;
                }
            }
        }
        return processed;
    }

    private static async Task<OutboxItem?> LockNextEventAsync(
        OracleConnection connection, DbTransaction transaction, bool includeEmail,
        CancellationToken cancellationToken)
    {
        long id;
        string kind;
        int retryCount;
        // Select only base columns in FOR UPDATE; read the CLOB after locking.
        await using (var command = NewCommand(connection, transaction, """
            SELECT event_id, event_kind, retry_count
              FROM OUTBOX_EVENTS
             WHERE status='PENDING'
               AND next_attempt_at<=SYSTIMESTAMP
               AND (event_kind='REMINDER_IN_APP' OR
                    (:include_email=1 AND event_kind='EMAIL_NOTIFICATION'))
             ORDER BY next_attempt_at, event_id
             FOR UPDATE SKIP LOCKED
            """))
        {
            command.Parameters.Add("include_email", OracleDbType.Int32).Value = includeEmail ? 1 : 0;
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            if (!await reader.ReadAsync(cancellationToken).ConfigureAwait(false)) return null;
            id = reader.GetInt64(0);
            kind = reader.GetString(1);
            retryCount = reader.GetInt32(2);
        }
        await using var payload = NewCommand(connection, transaction, """
            SELECT DBMS_LOB.SUBSTR(payload_json,4000,1)
              FROM OUTBOX_EVENTS WHERE event_id=:id
            """);
        payload.Parameters.Add("id", OracleDbType.Int64).Value = id;
        var text = await payload.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) as string;
        if (text is null) throw new InvalidDataException("Outbox payload is not readable.");
        return new OutboxItem(id, kind, text, retryCount);
    }

    private static async Task ProcessInAppReminderAsync(
        OracleConnection connection, DbTransaction transaction,
        string payload, CancellationToken cancellationToken)
    {
        var reminder = JsonSerializer.Deserialize<ReminderPayload>(payload, JsonOptions)
            ?? throw new InvalidDataException("Missing reminder payload.");
        if (reminder.UserId <= 0 || reminder.SourceId <= 0)
            throw new InvalidDataException("Invalid reminder identifiers.");

        var (sql, kind, title, body) = reminder.ReminderType switch
        {
            "CARE" => (
                """SELECT COUNT(*) FROM CARE_TASKS c JOIN PETS p ON p.pet_id=c.pet_id JOIN USERS u ON u.user_id=p.owner_user_id WHERE c.care_task_id=:source_id AND p.owner_user_id=:user_id AND c.status='PENDING' AND p.status='ACTIVE' AND u.status='ACTIVE' AND c.due_at BETWEEN SYSTIMESTAMP-NUMTODSINTERVAL(1,'DAY') AND SYSTIMESTAMP+NUMTODSINTERVAL(30,'MINUTE')""",
                "CARE_REMINDER", "Pet care reminder", "You have a care task to review."),
            "APPOINTMENT" => (
                """SELECT COUNT(*) FROM APPOINTMENTS a JOIN PETS p ON p.pet_id=a.pet_id JOIN USERS u ON u.user_id=p.owner_user_id WHERE a.appointment_id=:source_id AND p.owner_user_id=:user_id AND a.status='CONFIRMED' AND p.status='ACTIVE' AND u.status='ACTIVE' AND a.starts_at BETWEEN SYSTIMESTAMP AND SYSTIMESTAMP+NUMTODSINTERVAL(24,'HOUR')""",
                "APPOINTMENT_REMINDER", "Upcoming veterinary visit", "An appointment is coming up."),
            "VACCINATION" => (
                """SELECT COUNT(*) FROM VACCINATIONS v JOIN PETS p ON p.pet_id=v.pet_id JOIN USERS u ON u.user_id=p.owner_user_id WHERE v.vaccination_id=:source_id AND p.owner_user_id=:user_id AND v.next_due_at IS NOT NULL AND v.next_due_at BETWEEN SYSTIMESTAMP-NUMTODSINTERVAL(1,'DAY') AND SYSTIMESTAMP+NUMTODSINTERVAL(7,'DAY') AND p.status='ACTIVE' AND u.status='ACTIVE' AND NOT EXISTS (SELECT 1 FROM VACCINATIONS newer WHERE newer.pet_id=v.pet_id AND UPPER(newer.vaccine_name)=UPPER(v.vaccine_name) AND newer.administered_at>v.administered_at)""",
                "VACCINATION_REMINDER", "Vaccination reminder", "A vaccination date is approaching."),
            _ => throw new InvalidDataException("Unsupported reminder type.")
        };
        await using (var check = NewCommand(connection, transaction, sql))
        {
            check.Parameters.Add("source_id", OracleDbType.Int64).Value = reminder.SourceId;
            check.Parameters.Add("user_id", OracleDbType.Int64).Value = reminder.UserId;
            var eligible = Convert.ToInt32(await check.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false));
            if (eligible != 1) return; // Changed/cancelled/superseded: no alert.
        }

        await using var insert = NewCommand(connection, transaction, """
            INSERT INTO NOTIFICATIONS (user_id,kind,title,body_text,payload_json)
            VALUES (:user_id,:kind,:title,:body,:payload)
            """);
        insert.Parameters.Add("user_id", OracleDbType.Int64).Value = reminder.UserId;
        insert.Parameters.Add("kind", OracleDbType.Varchar2).Value = kind;
        insert.Parameters.Add("title", OracleDbType.Varchar2).Value = title;
        insert.Parameters.Add("body", OracleDbType.Varchar2).Value = body;
        insert.Parameters.Add("payload", OracleDbType.Varchar2).Value = JsonSerializer.Serialize(new
        {
            reminderType = reminder.ReminderType,
            sourceId = reminder.SourceId
        });
        if (await insert.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false) != 1)
            throw new InvalidOperationException("Notification insert failed.");
    }

    private static async Task SendNotificationEmailAsync(
        OracleConnection connection, DbTransaction transaction, string payload,
        IEmailGateway email, CancellationToken cancellationToken)
    {
        // This event MUST be produced only after affirmative email opt-in is
        // enforced by its producer. Current schema has no preference table, so
        // ReminderWorker never produces email events automatically.
        var message = JsonSerializer.Deserialize<EmailPayload>(payload, JsonOptions)
            ?? throw new InvalidDataException("Missing email payload.");
        if (message.NotificationId <= 0)
            throw new InvalidDataException("Invalid notification ID.");
        await using var command = NewCommand(connection, transaction, """
            SELECT u.email
              FROM NOTIFICATIONS n
              JOIN USERS u ON u.user_id=n.user_id
             WHERE n.notification_id=:notification_id
               AND u.status='ACTIVE' AND u.email_verified_at IS NOT NULL
            """);
        command.Parameters.Add("notification_id", OracleDbType.Int64).Value = message.NotificationId;
        var address = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) as string;
        if (address is null) return; // Recipient unavailable; do not mail.

        // Generic text prevents disclosing pet medical details by email.
        await email.SendAsync(new EmailMessage(address, "PawCare update",
            "You have a new notification in PawCare. Please open the app to review it."),
            cancellationToken).ConfigureAwait(false);
    }

    private static OracleCommand NewCommand(
        OracleConnection connection, DbTransaction transaction, string sql)
    {
        var command = connection.CreateCommand();
        command.Transaction = (OracleTransaction)transaction;
        command.BindByName = true;
        command.CommandTimeout = 35; // SMTP timeout is 30 seconds.
        command.CommandText = sql;
        return command;
    }

    private sealed record OutboxItem(long Id, string Kind, string Payload, int RetryCount);
    private sealed record ReminderPayload(long UserId, string ReminderType, long SourceId);
    private sealed record EmailPayload(long NotificationId);
}
