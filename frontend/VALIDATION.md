# PawCare Frontend — Validation & known boundaries

Generated for the Oracle-only ASP.NET Core 10 PawCare rebuild.

## Checks performed in the artifact generation environment

- 39 requested page routes exist, plus the 2 requested API route handlers.
- TypeScript 5.9 parser: all `.ts` and `.tsx` files parsed with **zero syntax diagnostics**.
- Local import resolution: all `@/`, `./`, and `../` paths referenced by TS/TSX files resolve to existing source files.
- App Router route-group check: no two pages produce the same URL after stripping `(public)`, `(auth)`, `(owner)`, `(vet)`, and `(admin)` segments.
- Server-only API URL is not referenced by client components; the relay blocks direct forwarding to auth/token endpoints and payment webhooks. React Server Component boundaries were reviewed and callback-bearing forms moved into client components.
- Static checks **do not** prove the compiled application works or that Oracle-backed operations succeed.

## Checks that could not be performed here

- `npm install` failed because `registry.npmjs.org` could not be resolved (`EAI_AGAIN`).
- Therefore `next build`, real TypeScript typechecking with dependency types, Vitest execution and browser testing **are not verified**.
- The .NET backend also has not been verified as a single compiled, deployed application; these pages consume routes from its previously delivered module sources.
- Test with non-production Oracle data before enabling registrations, moderation, payments or order processing.

## Backend dependencies / open gaps

- New user accounts remain pending until email verification. The backend now exposes verification and resend endpoints; the web client supports resend and a verification-link redirect when `Email:VerificationUrlBase` uses the web origin. Email delivery still needs a configured provider.
- No password-reset API exists yet.
- After the short-lived access cookie expires, a full server-side navigation may require signing in again; the browser relay can rotate tokens for in-page API requests, but transparent refresh during a new SSR navigation is not implemented.
- No private listing-history query for all of a user's drafts exists yet.
- No administrator-wide order-list query exists yet.
- No veterinarian-assigned medical-record read API exists yet.
- Monetary donations, animal sale completion and food-payment capture are intentionally disabled by the backend.
- Safe public delivery of uploaded pet photographs remains blocked pending scanning/approval.
- Web pages protect role routes in server layouts; API endpoints must *also* enforce authorization and record ownership.

## Local verification commands

From `frontend/` on your Windows PC after installing Node.js 22:

```powershell
Copy-Item .env.example .env.local
# Edit .env.local to point to your running Oracle-backed API.
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

For production, configure HTTPS, secrets, secure session-cookie behavior, reverse-proxy headers, monitoring and feature-level tests. Do not treat a clean static audit as launch approval.

## Authentication update (2026-11-07)

See `AUTHENTICATION.md` for role-aware login redirect, registration validation, resend flow, and the optional web-facing email verification completion route. The original static checks above describe an earlier artifact build; this update was syntax-checked locally, but an npm dependency install was unavailable in the packaging environment, so new Vitest/Next.js results require running the provided Windows commands.
