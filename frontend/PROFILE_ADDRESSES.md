# PawCare profile and address management (Phase 8)

Uses only the existing authenticated `/users/me` and `/users/me/addresses` API endpoints. Requests are made through the existing same-origin Next.js relay (`/api/relay/*`) and preserve server-side session-cookie security.

## Supported functionality

- Read profile identity (email, role, account status). Email/role/status are read-only.
- Update display name (120 UTF-8 bytes maximum), phone (optional E.164), IANA time zone (64 UTF-8 bytes maximum), language tag (16 UTF-8 bytes maximum).
- Read all active saved shipping and billing addresses.
- Create a shipping or billing address with recipient (160 UTF-8 bytes), first line (200 UTF-8 bytes), city (100 UTF-8 bytes), two-letter country code, and a valid scope.
- Search and filter existing addresses, report backend validation errors, retry failed loads, and preserve unsaved form fields when an API write fails.

## API boundaries

- No API supports editing, deleting or setting a default address in this implementation.
- No API supports changing the current account email, role or password from this UI.
- The backend remains the authority on authorization and storage. This frontend does not query Oracle directly.
- Client-side validations reduce accidental invalid requests, but are not security controls; backend validation is required.

## Checks

From `frontend/` on Windows:

```powershell
npm run typecheck
npm test
npm run build
```

Local source-level checks in the delivery environment are separate from these build/Vitest checks. Live profile saving and address creation should be verified with a local authenticated API/Oracle connection.
