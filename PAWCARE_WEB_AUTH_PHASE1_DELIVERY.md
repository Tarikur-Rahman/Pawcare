# PawCare — Web authentication phase 1 delivery (2026-11-07)

This ZIP is a **complete updated copy of the exported PawCare source tree**, not just a patch. The Oracle migrations, database schema, backend modules, and mobile screens are unchanged from the supplied archive. This phase improves the existing Next.js 16 web authentication workflow.

## Changed frontend files

- `components/features/AuthForms.tsx`: validates backend-aligned registration requirements, confirms password, shows proper verification instructions, resends verification, and routes successful logins by role.
- `lib/auth/destinations.ts` (new): validates role-appropriate internal post-login return paths.
- `lib/auth/session.ts`: sends signed-out users to the right role's login destination.
- `lib/api/client.ts`: adds a resend-verification action and explicit network-error handling.
- `app/api/auth/[action]/route.ts`: allow-lists the resend-verification endpoint, retaining same-origin mutation protection.
- `app/(auth)/login/page.tsx`: accepts `next` and success-message parameters from Next.js 16 async search params.
- `app/(auth)/resend-verification/page.tsx` (new): public resend form.
- `app/(auth)/verify-email/page.tsx` (new): expired/unavailable link guidance.
- `app/api/v1/auth/verify-email/route.ts` (new): optional web-facing link handler for backend-generated verification URLs. Redirects after forwarding verification to the existing API.
- `components/layout/Sidebar.tsx`: handles logout in-progress and failures visibly, without pretending a network-failed logout succeeded.
- `app/globals.css`: authentication and sidebar feedback styling.
- `tests/auth.test.tsx` (new): focused UI and safe-redirect unit tests.
- `tests/routes.test.ts`: includes the new routes.
- `AUTHENTICATION.md` (new): setup, security behavior, and limitations.
- `VALIDATION.md`: updated documentation.

## Validation evidence

- All 117 frontend TS/TSX sources were parsed using locally available TypeScript tooling; **zero syntax errors**.
- All local relative / `@/` imports resolved in static checking.
- 13 real compiled `postLoginDestination` cases passed in a dependency-free runtime smoke check.
- `npm ci` could not finish because dependencies could not be fetched here; the project **was not** fully typechecked, built with Next.js, or executed with Vitest/browser tests in this environment.
- No Oracle connection or migrations were executed. The user's previously reported 19/19 authenticated Oracle integration tests were **not rerun**.

## Run on Windows

1. Extract the ZIP **beside** your current PawCare project, not over it. Review changes before merging.
2. In PowerShell, go into the extracted `PawCare/frontend` folder.
3. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` sequentially.
4. Run the ASP.NET backend against your existing Oracle instance, configure `PAWCARE_API_URL` for the frontend, and test login and registration with test accounts.
5. For a friendly browser redirect after email verification, configure the backend's `Email:VerificationUrlBase` to the **web frontend origin**. Read `frontend/AUTHENTICATION.md`. SMTP must be configured and operational for new registrations to send actual email.

Please do not copy this artifact's generated files over the baseline without reviewing it. Never commit `.env.local`, SMTP credentials, Oracle credentials, JWT secrets, or verification token URLs.
