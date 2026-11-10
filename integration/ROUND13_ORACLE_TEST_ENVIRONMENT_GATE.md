# Round 13 — Oracle Test Environment Readiness Gate

## Outcome and scope

The existing Round 12 source/build/web/mobile tests passed on the user's Windows workstation. No authorized Oracle test PDB credentials or live connection were supplied, so **no live Oracle check or migration was executed in Round 13**. This change adds a non-destructive readiness script and a SQL read-only identity gate. It does **not** change the API, its DB connection configuration, database bootstrap, existing migrations V001–V012, seed data, or test cases.

## Why two gates?

1. `scripts/check-oracle-readiness.ps1`: local-only environment inventory; checks 12 migration scripts, relevant verification files, whether SQL*Plus/SQLcl is on `PATH`, and detects local Oracle Windows services. **It does not contact Oracle.**
2. `database/oracle/verification/verify_test_target_read_only.sql`: when manually run within an Oracle SQL*Plus/SQLcl session, refuses root/seed containers and prints the actual session/PDB/account and whether `PAWCARE_APP` exists. **It does not create or alter objects.** A non-root PDB is not in itself proof that it is disposable or non-production; the operator must independently establish that.

## First steps from Windows PowerShell

From the PawCare repository root, review and run the local readiness script:

```powershell
Get-Content .\scripts\check-oracle-readiness.ps1
Unblock-File .\scripts\check-oracle-readiness.ps1
# If required by your own machine policy: Set-ExecutionPolicy -Scope Process RemoteSigned -Force
.\scripts\check-oracle-readiness.ps1
```

If SQL*Plus is absent and there is no existing Oracle client, install Oracle Database Free or an Oracle client using Oracle's official instructions. Do not overwrite an existing database installation. For a local, *dedicated and disposable* Oracle Free PDB, `FREEPDB1` is commonly the default service. Substitute the real service if different. The project requires Oracle 19c+.

If SQL*Plus is available, use an **already authorized, isolated test PDB** (here `FREEPDB1` is illustrative):

```powershell
sqlplus /nolog
```

At the `SQL>` prompt, enter:

```sql
CONNECT SYSTEM@//localhost:1521/FREEPDB1
@database/oracle/verification/verify_test_target_read_only.sql
EXIT
```

SQL*Plus will securely prompt for the account password. Do **not** put the password in the command, script, shared logs, or screenshots. Do **not** run `sqlplus / as sysdba` and then execute PawCare schema scripts in `CDB$ROOT`.

## Decision after the gate

- If the SQL client/Oracle server is unavailable: install or configure the **separate local test environment** first; do not configure the API against production to bypass this step.
- If the database/PDB identity does not match the approved test target: STOP. Do not proceed with any schema operation.
- If `PAWCARE_APP` is **absent** in a confirmed fresh disposable test PDB: the next controlled step is the one-time `database/oracle/000_create_schema.sql` as DBA in that PDB, followed by connecting as `PAWCARE_APP` and applying *exactly* V001 through V012, then seed `001_reference_data.sql`, then the existing three SQL verification scripts. Read `database/oracle/README.md` and the rollback runbook beforehand. These write operations **are not automated** by this gate. Oracle DDL auto-commits and must never be blindly retried after a partial failure.
- If `PAWCARE_APP` **already exists**: STOP and first inspect owner/schema/migration history; do not rerun the bootstrap or migrations. If it is a deliberately pre-provisioned test PDB, run `database/oracle/rollback/preflight_read_only.sql` *after V001 exists* and compare applied checksums.

### What the current tests actually do

- The integration project has **1 offline migration-check test** that runs without Oracle.
- **8 read-only Oracle schema/parity tests** use `SkipUnless = ApiDatabaseFixture.IsEnabled` and require all four environment variables: `PAWCARE_TEST_ORACLE_OPT_IN`, `PAWCARE_TEST_ORACLE_CONNECTION`, `PAWCARE_TEST_EXPECTED_PDB`, `PAWCARE_TEST_EXPECTED_SCHEMA`. The fixture compares `SESSION_USER`, `CURRENT_SCHEMA` and `CON_NAME` before enabling a read-only transaction. Use only isolated test credentials. Do not expose the connection string in chat/logs. Setting the opt-in cannot provision the PDB or apply migrations.
- **18 API feature integration tests are separately skipped** because a deployed real feature API test environment is not yet configured. Those do not become active merely by enabling the Oracle opt-in.
- **The source-only counts** are 12 migrations, 50 tables, 99 foreign keys, 109 explicit indexes, and 4 public views; these have **not yet been confirmed in an actual Oracle instance**.

## Success criteria for this Round 13 gate

- Local script confirms V001–V012 and shows the client/service situation.
- Manual SQL read-only identity query returns the correct **authorized, disposable test PDB** and appropriate administrative/owner account; operator checks whether `PAWCARE_APP` exists.
- No production database is contacted or modified.

The next validation milestone, **after provisioning**, is a live Oracle schema/seed integrity check and the eight Oracle read-only xUnit tests. This is a test environment milestone, **not** a production readiness declaration.
