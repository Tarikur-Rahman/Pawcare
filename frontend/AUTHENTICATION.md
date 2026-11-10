# PawCare web authentication (Next.js 16)

This module uses the existing ASP.NET Core 10 API and Oracle schema. No browser JavaScript receives access or refresh tokens: `/api/auth/*` sets HTTP-only, SameSite=Strict cookies and `/api/relay/*` forwards authenticated requests on the server.

## Available user workflows

- `/register`: creates an OWNER account in PENDING_VERIFICATION status, then directs the user to check email.
- `/resend-verification`: requests a new verification email. The backend returns the same generic acceptance message regardless of whether an eligible account exists.
- `/login`: authenticates, fetches `/auth/me`, and redirects to the user's authorized workspace. An internal `next` path is accepted only if it belongs to that role's workspace.
- `/dashboard`, `/vet`, `/admin`: layouts verify the authenticated role on the server. Sign out revokes the refresh session when possible and clears both cookies.
- `/forgot-password`: submits a generic password-recovery request. For eligible ACTIVE accounts, the backend emails a 30-minute single-use token.
- `/reset-password`: reads a token from the URL fragment, scrubs it from browser history, then submits a new password through the same-origin Next.js API proxy. No account existence is disclosed by the recovery request.

## Verification link configuration

The ASP.NET backend currently generates verification links as:

`{Email:VerificationUrlBase}/api/v1/auth/verify-email?token=...`

Set the **backend** configuration `Email:VerificationUrlBase` to the *public origin of this Next.js website* (for example `https://web.example.com`, without a trailing `/`) to use the frontend's verification-completion redirect route. This Next.js route forwards the token to the API over the configured server-side `PAWCARE_API_URL`, then redirects to a success or failure page without leaving the token in the redirect URL.

If `Email:VerificationUrlBase` still points directly to the API server, the API's existing GET verification endpoint will activate the account but return HTTP 204 (a blank browser page). Both approaches verify accounts; the frontend destination is preferable for user experience. Do not change this setting without confirming that email delivery is configured and the public URL is HTTPS in production.

The new Next.js verification route is public but accepts only a correctly shaped, single-use token. Never log token query strings, proxy server logs containing sensitive URLs, or email bodies. Token expiry and replay prevention remain enforced by the backend.

## Local commands

From `frontend/` with Node.js 22 and a running PawCare API:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

Set `PAWCARE_API_URL` in `frontend/.env.local` to the server-side URL for the ASP.NET API (default: `http://127.0.0.1:5080`). This environment variable does **not** require a `NEXT_PUBLIC_` prefix. Keep Oracle credentials only on the backend.

## Boundaries

- Email delivery and expiry/replay behavior require a configured provider and live API integration test; they cannot be proven by frontend-only tests.
- Server-rendered workspace navigation after access-cookie expiry still requires reauthentication; only the browser relay transparently refreshes tokens at present.
- Password recovery requires additive Oracle V014 before API deployment. See [V014 runbook](../docs/PASSWORD_RECOVERY_V014.md).
- Resetting a password revokes refresh sessions immediately; stateless access tokens remain valid until their short normal expiration.
