# PawCare Oracle — Rollback and Recovery

This directory contains **read-only assessment scripts** and a **documented, DBA-approved recovery process**, not executable destructive reverse migrations.

## Files

| File | Use |
|---|---|
| [`migration_recovery_runbook.md`](migration_recovery_runbook.md) | Decide how to recover an incomplete migration, restore from backup, or deploy a compensating fix. Includes a V012-to-V001 dependency review. |
| [`preflight_read_only.sql`](preflight_read_only.sql) | Capture schema identity, applied versions, objects, constraint state and current row counts before a change. Requires V001. |
| [`verify_after_recovery.sql`](verify_after_recovery.sql) | Read-only check of schema and constraint state after recovery; tolerant of a partially initialized schema. |

## Safety policy

- **Production migration rollback is not automatic.** Oracle DDL auto-commits and the migrations create dependent tables. Dropping tables would destroy records.
- Always have an independently validated backup or isolated clone before any high-risk action; the SQL files do not create backups.
- Never use test-data cleanup procedures on live environments.
- No scripts here modify data or schema objects; `SET`, `SELECT`, `DECLARE` and reporting-only `DBMS_OUTPUT` are used.
- Only the Oracle environment is in scope. SQLite was explicitly excluded from PawCare.

Read the [runbook](migration_recovery_runbook.md) before making production changes.
