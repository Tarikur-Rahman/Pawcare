# PawCare Integration — Round 2 (2026-11-06)

**Decision:** Oracle Database only. This is a **source integrity and readiness audit**, not a certified functional release. No real Oracle credentials, private patient/pet data, or deployment secrets were used.

## What changed in this pass

1. Added `scripts/release-preflight.py`, a non-destructive check that explicitly classifies `PASS`, `BLOCKED`, `NOT_RUN`, `INCOMPLETE`, and `FAIL`; produces `integration/ROUND2_OFFLINE_PREFLIGHT.json`.
2. Corrected misleading web/mobile test step labels in `.github/workflows/ci.yml` and added the existing source/checksum audit to its module-detection job.
3. Updated `docs/architecture.md`, `docs/deployment.md`, `docs/data-dictionary.md`, and `docs/acceptance-tests.md` to reflect the confirmed **Oracle-only** decision and the actual server-side `PAWCARE_API_URL` setting. Those older documents were previously inconsistent with the assembled project.
4. Re-generated the source file SHA-256 manifest after the changes.
5. Preserved the existing C# feature modules, Oracle migration files, and web/mobile application sources; no runtime behavior was changed in this pass.

## Checks executed here

| Check | Result | Evidence and limitation |
|---|---|---|
| V001–V012 source checksum scope | PASS (12/12) | `scripts/source-audit.py`; **not live SQL execution** |
| Oracle source object count | PASS | 50 `CREATE TABLE`, 99 FK, 109 explicit index, 4 public view definitions; lexical inventory only |
| No SQLite folder | PASS | `scripts/source-audit.py` |
| Backend module count | PASS (22) | Files and endpoint entry points are present; no C# compilation performed |
| Next.js app route count | PASS (39) | File-level route inventory |
| TypeScript parser/local imports | PASS | 112 web source files / 221 local imports; 94 mobile source files / 388 local imports |
| Project JSON/XML and GitHub workflow YAML | PASS | Static syntax validation |
| Source archive integrity | PASS | ZIP verification and updated SHA-256 manifest |
| .NET build / unit tests | BLOCKED | No .NET SDK installed in this execution environment |
| `npm install`, Next.js build, Expo/Jest tests | BLOCKED | npm registry unreachable, dependencies and lockfiles not installed |
| Oracle migration deployment, integration | NOT RUN | No authorized disposable Oracle PDB or credentials |
| Physical Android/browser/EAS | NOT RUN | No device/cloud build context in this environment |

**Do not count blocked, skipped, or unrun checks as passed.**

## Confirmed release blockers

- `frontend/package-lock.json` and `mobile/package-lock.json` are absent. Create them by running `npm.cmd install` in each app on a network-connected development computer. Keep both lockfiles in Git and run `npm ci` in GitHub Actions; do not fabricate or hand-author lockfiles.
- No successful `.NET 10` project compilation, xUnit run, Next.js production build, Expo Android bundle or real endpoint request has been recorded.
- V001–V012 have passed source checks but **have not been executed against your Oracle environment by this audit**.
- Newly registered accounts remain `PENDING_VERIFICATION`. Backend admin activation requires an already authenticated admin; the first administrator bootstrap and user email verification path need an authorized implementation before new users can self-onboard.
- The payment provider is deliberately disabled; no food-order payment should be reported as `CAPTURED` until signed callbacks and sandbox validation are implemented.
- Public media publication, some account recovery and notification flows remain gated; do not treat screenshots/source file presence as live behavior.
- C# module behavior and concurrent transactions (booking, adoption handover, stock reservation, idempotency) require integrated Oracle tests.

## Recommended Windows execution order

At the root of an extracted `PawCare` directory:

```powershell
# Tool prerequisites
node -v
npm.cmd -v
dotnet --version

# Non-destructive offline preflight, machine-readable output
python .\scripts\release-preflight.py --output integration/ROUND2_WINDOWS_PREFLIGHT.json

# Full toolchain verification; install dependencies and create lockfiles
.\scripts\verify-windows.ps1 -InstallDependencies

# Repeat preflight; both lockfiles should now be reported as present
python .\scripts\release-preflight.py --output integration/ROUND2_WINDOWS_PREFLIGHT.json
```

**Oracle:** Connect only to the intended development/test Oracle PDB. First inspect the `SCHEMA_MIGRATIONS` ledger and existing schema. Apply missing migrations in order only to a fresh/approved environment. Run the three `database/oracle/verification/*.sql` files and inspect their outcomes. Use `PAWCARE_TEST_ORACLE_OPT_IN=I_ACCEPT_READ_ONLY_ORACLE_TESTS` **only** with your isolated test PDB, not production.

**API:** Copy `backend/PawCare.Api/.env.example` to `.env`, add Oracle connection and a random signing key, and start the API with `scripts/start-api-dev.ps1` on a machine permitted by its Windows Application Control policy. Test `http://127.0.0.1:5080/api/health` for liveness and `/api/health/ready` for Oracle readiness. Readiness should not be assumed from liveness.

**Web:** `PAWCARE_API_URL=http://127.0.0.1:5080` in `frontend/.env.local`, then `npm.cmd run dev` after installation. **Mobile physical phone:** `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:5080` in `mobile/.env`; API must intentionally listen on the private LAN and Windows Firewall must permit it. A Node/Expo Metro QR code does not prove backend connectivity.

For failures, preserve terminal logs and report the first failing command and the complete error (with secrets redacted). The fix must be verified by rerunning the failed command and dependent tests.

## Release decision

**NOT READY FOR PRODUCTION.** This deliverable is a newly audited source baseline with improved documentation and a repeatable preflight. A full passing build and real Oracle-backed/Android functional test cycle are still mandatory before calling PawCare complete.
