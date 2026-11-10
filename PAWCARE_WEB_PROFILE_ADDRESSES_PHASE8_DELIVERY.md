# PawCare — Phase 8: Profile & Address Management

**Baseline:** Complete Phase 7 TestFix archive. User reported passing TypeScript, 178/178 Vitest checks, and Next.js production build.

## Scope
- Display read-only identity information (email, role and account status).
- Edit own display name, E.164 phone (including removal), IANA time zone and language/region tag.
- Create own shipping/billing addresses; list, search and filter saved addresses.
- Independent loading, retry and error handling for profile and addresses.
- Client validation consistent with the current `UsersService` contract and server field errors.
- No invented address edit/delete/default change, email change or password change action.
- Preserve all existing database migrations, C# API source, mobile source and earlier web modules.

## Actual backend endpoints
- `GET /api/v1/users/me` — profile.
- `PATCH /api/v1/users/me` — `displayName`, `timeZone`, `locale`, `phone` (nullable).
- `GET /api/v1/users/me/addresses` — list of active personal addresses.
- `POST /api/v1/users/me/addresses` — `recipientName`, `line1`, `city`, `countryCode`, `scope` (`SHIPPING`/`BILLING`).

## Windows validation
```powershell
Set-Location 'C:\Users\Tarik\OneDrive\Documents\PawCare\frontend'
npm run typecheck
npm test
npm run build
```

No backend or Oracle changes. UI actions must also be checked with a running authenticated API/Oracle connection during browser integration testing.
