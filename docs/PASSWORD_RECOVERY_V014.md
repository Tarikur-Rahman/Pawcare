# PawCare V014 | Forgot Password / Reset Password

## Overview

This is an **additive Oracle-only** feature. It does not reset or delete existing users, replace V001–V013, or store recoverable passwords. The target is the current ASP.NET Core 10 API + Next.js 16 frontend + Oracle `PAWCARE_APP` in `FREEPDB1`.

## API

- `POST /api/v1/auth/forgot-password` body `{ "email": "owner@example.com" }` -> HTTP 202 generic response for known, unknown, suspended, or account-issuance-limited users. Per-IP throttling can return HTTP 429 regardless of account status. Email is sent **only to ACTIVE accounts**. No token or account status returned.
- `POST /api/v1/auth/reset-password` body `{ "token": "<64-character opaque token>", "newPassword": "<12..128 characters>" }` -> HTTP 200 when successful. Invalid/expired/reused tokens return a generic error.
- Both routes allow unauthenticated users, are subject to the API's global request limit and a `password-recovery` anonymous IP policy (10 requests per 15 minutes).

## Security model

- Uses the existing cryptographically secure generator (48 random bytes, 64 unpadded base64url characters).
- Stores **only SHA-256(token)** in the new `PASSWORD_RESET_TOKENS` table. Raw token appears only in a plain-text recovery email and the browser's URL **fragment** (`#token=`), which is not sent in HTTP requests. The frontend scrubs the fragment from browser history after reading it.
- Tokens expire in **30 minutes**; one pending token per account, maximum three issued in a rolling hour. Requests for suspended/disabled/unverified accounts do not send email.
- Under a single Oracle transaction, successful reset changes `USERS.PASSWORD_HASH` to the existing salted PBKDF2 hash, marks outstanding reset links used, and revokes **all refresh sessions** in `SESSIONS`.
- Existing stateless **JWT access tokens remain usable until their normal expiration** (typically 15 minutes); refresh tokens stop working. Immediate JWT revocation would require adding live authorization checks to all protected requests and is not claimed in this patch.
- Passwords and tokens must never appear in application logs, screenshots, or support tickets. Email dispatch is performed from a bounded, non-persistent in-memory queue after request acceptance to avoid waiting for SMTP in the HTTP response. Unexpected SMTP failures are logged without raw provider error details. Queue contents can be lost if the API container stops before dispatch; production requires a durable encrypted dispatch design. SMTP acceptance does not prove mailbox delivery.
- Local development permits `http://localhost:3000` as the recovery link origin. Non-loopback origins must be HTTPS. Set `Email:VerificationUrlBase` to the **frontend's** HTTPS origin in production.
- A trusted reverse proxy is required to make IP-based throttling meaningful behind proxy infrastructure. The rate policy uses the actual connection's remote IP; do not trust arbitrary forwarded headers.

## Oracle deployment: migration-first

**Do not deploy the V014 API before the migration**: `/api/health/ready` now expects V001–V014 and will otherwise return HTTP 503.

1. Ensure an independently verified backup/restore plan. Use PowerShell in the PawCare repository root. The commands are interactive; **do not paste passwords into CLI arguments**.
2. Open SQL*Plus as the existing account:

   ```powershell
   sqlplus -L PAWCARE_APP@localhost:1521/FREEPDB1
   ```

3. Type the Oracle password when prompted. At the `SQL>` prompt:

   ```sql
   SHOW USER
   SHOW CON_NAME
   @database\oracle\deployment\preflight_v014_read_only.sql
   ```

4. Confirm `PASS | V014 preflight`, review the exact V001–V013 ledger results, and then **explicitly authorize** the one-time new migration:

   ```sql
   @database\oracle\deployment\apply_v014_only.sql
   ```

   At the approval prompt enter `APPLY_V014`. The deploy wrapper runs the read-only preflight again, applies **V014 only**, and runs read-only verification. It does **not** rerun V001–V013, seeds, or other SQL.

5. If any Oracle error appears after DDL begins: **STOP**. Do not rerun blindly; Oracle DDL auto-commits. Inspect object and ledger state and follow the established DBA recovery practice. A failed ledger insert can leave created objects without a V014 ledger row.
6. Read-only post-check can be repeated anytime:

   ```sql
   @database\oracle\deployment\verify_v014.sql
   ```

## Build and local startup (Windows PowerShell 5.1)

Run after installing this patch into the project and completing V014:

```powershell
cd "C:\Users\Tarik\OneDrive\Documents\PawCare"
dotnet test .\backend\PawCare.Api.Tests\PawCare.Api.Tests.csproj
dotnet test .\backend\PawCare.IntegrationTests\PawCare.IntegrationTests.csproj
cd .\frontend
npm ci
npm run typecheck
npm test
npm run build
```

Dedicated live Oracle tests have separate opt-in and must target an isolated disposable test schema. Do not point them at the user's active account database.

Rebuild the already-working Linux Docker image (avoids Windows Smart App Control blocking local API assemblies):

```powershell
cd "C:\Users\Tarik\OneDrive\Documents\PawCare\backend\PawCare.Api"
docker build --progress=plain -t pawcare-api:local .
```

Recreate `pawcare-api-local` with the **same secure Oracle, JWT, Gmail SMTP, CORS and disabled worker environment** previously used for port `127.0.0.1:18080:8080`. Re-enter the verified Gmail App Password privately; do not use `docker commit`, expose credentials on the CLI, or copy `.env` secrets into the image. Restarting an old container will **not** update its image or environment.

Verify:

```powershell
Invoke-WebRequest 'http://127.0.0.1:18080/api/health' -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest 'http://127.0.0.1:18080/api/health/ready' -UseBasicParsing | Select-Object StatusCode
```

Both should return `200` after V014. For Next.js in a separate PowerShell terminal:

```powershell
cd "C:\Users\Tarik\OneDrive\Documents\PawCare\frontend"
$env:PAWCARE_API_URL = 'http://127.0.0.1:18080'
npm run dev
```

If port 3000 is occupied, identify the existing PawCare Node process first. Don't terminate unrelated services.

## Acceptance test using the existing account

1. Open `http://localhost:3000/forgot-password`.
2. Submit the existing verified PawCare account email **once**. The response must not reveal whether an account exists.
3. Receive the recovery email from PawCare Gmail SMTP and open the new link. It goes to `/reset-password#token=...`.
4. Enter and confirm a new password (12–128 chars). Expect a success message.
5. Sign in at `/login` using the same email and the **new PawCare password**; this is not the Gmail App Password.
6. Confirm the old password fails and the reset link cannot be used again. Existing refresh sessions should be revoked.
7. Check only **redacted** application logs if something fails:

   ```powershell
   docker logs --tail 100 pawcare-api-local
   ```

## Limitations / validation status

- This package was produced without a local .NET SDK or access to your Windows Docker and Oracle instance. It has **not** been compiled with .NET 10, nor applied or exercised against your live PDB in this environment. Run the Windows build, migration verification, frontend tests and end-to-end acceptance test above before calling it deployed.
- The provided frontend project dependencies could not be installed in the authoring container due to unavailable access to npm's registry. Local Windows `npm ci` is required.
- The source snapshot is based on your most recent supplied **PawCare Routing/Redirect Loop Fixed 20261108** archive. Use the patch installer preflight to protect local source changes.
