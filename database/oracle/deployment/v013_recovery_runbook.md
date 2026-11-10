# V013 Recovery Procedure

V013 contains Oracle DDL. DDL auto-commits, so a failed run must never be
blindly retried. This procedure is read-only until an authorized DBA selects
an approved recovery action.

## Assess the state

From the repository root, start an interactive client without credentials:

```powershell
sqlplus /nolog
```

In SQL*Plus, authenticate privately and run:

```sql
CONNECT PAWCARE_APP@"//localhost:1521/FREEPDB1"
@database\oracle\deployment\preflight_v013_read_only.sql
@database\oracle\deployment\verify_v013.sql
```

If either script reports a partial or inconsistent state, stop. Do not run
`V013_auth_verification.sql` again.

## Authorized recovery

An authorized DBA must use the environment's validated backup/restore or
approved compensating-change procedure after reviewing the captured, sanitized
evidence. Do not drop `EMAIL_VERIFICATION_TOKENS`, constraints, or indexes
automatically: application data may already exist in the table.

After recovery or a separately approved completion, rerun only the read-only
preflight and `verify_v013.sql`. Do not rerun V001-V012, reference seeds, or
the full migration orchestration.
