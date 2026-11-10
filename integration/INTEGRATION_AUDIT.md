> **Historical Round 1 audit.** For the latest source/documentation corrections and remaining blockers, see [ROUND2_AUDIT.md](ROUND2_AUDIT.md).

# PawCare — Integration Audit and Handoff

**Audit date:** 2026-11-06  
**Database decision:** Oracle only  
**Scope:** Earlier generated project packages assembled into a single repository. This is **not** a certification that the software builds, runs, or is production-ready.

## Delivered in this integration pass

- Merged the previous source archives into `PawCare/`; 375 unique source/configuration/documentation files before integration additions. The only duplicate path was `Infrastructure/Storage/ObjectStorage.cs`, and the two copies were byte-identical.
- Preserved the complete Oracle bootstrap, 12 migrations, three reporting queries, two seed scripts, three verification scripts, and recovery/data dictionary documents. SQLite files were intentionally excluded.
- Updated `backend/PawCare.Api/Program.cs` to register: shared options; security; Oracle DB connection and transaction helpers; payment, push, email and clock gateways; development-only private object storage; all three background workers; and all 22 feature endpoint groups. Replaced duplicate inline authorization and exception/request-ID blocks with the shared components.
- Added safe disabled-by-default `Workers`, `Push` and `Email` settings in `appsettings.json`.
- Removed the SQLite job from `.github/workflows/ci.yml` to align CI with Oracle-only architecture. Existing CI/security jobs remain and must be verified on GitHub.
- Added `scripts/source-audit.py`, `scripts/validate-typescript.cjs`, `scripts/verify-windows.ps1`, and `scripts/start-api-dev.ps1`, plus a top-level `.gitignore` and setup README.
- Recorded the Oracle-only decision in `docs/DECISIONS.md` to supersede older optional-SQLite language in prior documentation.

## Checks actually executed

| Check | Actual result | Meaning |
|---|---|---|
| Oracle migration source files V001–V012 | **PASS (12/12)** | SHA-256 matches the migration's embedded checksum text, no live database changes |
| Oracle-only structure | **PASS** | No SQLite database tree in the assembled repository |
| Backend feature-module folders | **PASS (22)** | Folder coverage, not runtime behavior |
| Backend C# source files | **101 present** | Inventory only; compilation not run |
| Backend startup registration strings | **PASS** | Required registrations present once and duplicate inline handler removed |
| Next.js page routes | **PASS (39)** | File existence and collision checks |
| Next.js TypeScript syntax and local imports | **PASS (112 files, 221 imports)** | TypeScript AST parse, local-import resolution; not full typecheck/build |
| Expo TypeScript syntax and local imports | **PASS (94 files, 388 imports)** | TypeScript AST parse, local-import resolution; not full typecheck/native build |
| JSON / C# project XML / workflow YAML | **PASS** | Syntax parsing, not all semantic behavior |
| .NET build and unit-test execution | **BLOCKED** | .NET SDK is unavailable in the integration runtime |
| npm install/web build/mobile tests | **BLOCKED** | npm registry packages missing from offline cache; npm install --offline returned ENOTCACHED |
| Oracle SQL execution/readiness/integration | **NOT RUN** | No live Oracle instance or test credentials provided |
| Browser, physical Android, Docker, deployments | **NOT RUN** | Require client devices, build dependencies and live services |

## Important remaining blockers

1. **Missing npm lockfiles:** `frontend/package-lock.json` and `mobile/package-lock.json` have not yet been generated. Existing GitHub CI requires both. Run `npm.cmd install` within each project on a network-connected Windows machine and commit the resulting lockfiles; then use `npm ci` in CI.
2. **Actual .NET compilation unknown:** Integrating C# files with static checks cannot prove that all type signatures, NuGet dependencies or LINQ/Oracle provider calls compile. Run `dotnet build`, fix all compiler errors, and rerun both test projects.
3. **Oracle not initialized/verified here:** Run schema bootstrap/migrations (one time on the designated PDB), seeds, verification checks, and read-only integration tests. Never apply migrations blindly against existing production data.
4. **Feature-level end-to-end behavior not verified:** Test registration/login, owner object access, appointment conflicts, adoption approvals/handover, lost-pet privacy, moderator permissions, order reservation/concurrency, inventory release, and reporting.
5. **External provider limits:** Live payment capture and monetary contributions, real animal-sale transactions, public media publication and some notification/account-recovery flows remain disabled or incomplete. Do not advertise these as production-capable.
6. **Deployment hardening:** Configure least-privilege Oracle runtime user, HTTPS, secrets management, backups/recovery, rate limits for sensitive routes, media scanning, alerting, and accessibility/security regression tests.
7. **Device validation:** Verify the mobile API URL points to the PC's current LAN address, API listening on the LAN only as permitted by Windows policy, Android permissions, token refresh and native notification support.
8. **Documentation drift:** Older files may still mention SQLite. `docs/DECISIONS.md` is authoritative until the legacy documents are revised.

## Windows verification commands

Open PowerShell from the integrated `PawCare/` directory. Install .NET 10 SDK, Node.js 22 and Oracle tooling first.

```powershell
# Creates npm lockfiles, restores/builds .NET and runs available tests.
.\scripts\verify-windows.ps1 -InstallDependencies

# Only if a dedicated Oracle test instance is configured and approved:
$env:PAWCARE_TEST_ORACLE_OPT_IN = 'I_ACCEPT_READ_ONLY_ORACLE_TESTS'
.\scripts\verify-windows.ps1 -RunOracleIntegrationTests
```

For individual commands and physical phone instructions see top-level `README.md`. Stop and review errors from each stage; the verification script does not suppress failing build or test results.

## Release gate

**Current result: NOT READY FOR PRODUCTION.** An actual successful .NET 10 build, Next.js production build, Expo Android export/build, Oracle migration/readiness verification, and end-to-end acceptance tests are the minimum next release gates. No percentage of completion or successful live-run claim is made without executing those tests.
