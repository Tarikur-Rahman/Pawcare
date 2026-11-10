# Phase 5 — Veterinary appointments (Next.js 16)

The existing PawCare API is unchanged. Owners may request visits for active pets; a veterinarian can confirm/reject a requested visit and complete/mark no-show a confirmed visit. Owners can cancel requested or confirmed visits. Terminal statuses cannot be actioned in the UI. The API authorizes every transition; frontend button visibility is not an authorization boundary.

## Actual API contracts

- `GET /api/v1/vets` (public) lists active veterinarians.
- `GET /api/v1/appointments` lists the authenticated user's appointments.
- `POST /api/v1/appointments` takes `petId`, `vetId`, `startsAt` and `endsAt` as ISO instants, and optional `reason`; result is `REQUESTED` until confirmed.
- `POST /api/v1/appointments/{id}/cancel` owner only, when requested or confirmed.
- `POST /api/v1/appointments/{id}/confirm` or `/reject` assigned vet only, when requested.
- `POST /api/v1/appointments/{id}/complete` or `/no-show` assigned vet only, when confirmed.

All calls use the authenticated `frontend/lib/api/client.ts` relay. The booking form checks local timestamps, future start, positive duration and an 8-hour upper bound. **No available appointment slots are asserted:** the backend checks overlaps during submission; conflicts return an API error. The current API does not expose vet schedules, dedicated slot availability, appointment rescheduling, or a cancellation/rejection reason field. These features are not simulated by the UI.

## UI

- Owner route `/appointments`: search/filter, booking history and scheduling, cancel with confirmation.
- Vet route `/vet/appointments`: assigned queue, confirm/reject requested visits, complete/no-show confirmed visits, destructive-action confirmation.
- Dates are entered in the browser's local timezone and sent as UTC ISO instants. The list presents localized date/time.
- No backend, database, migration, reminder worker, or other product modules were changed.

## Verification (Windows, from `PawCare/frontend`)

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Phase 4 had 115 passing frontend tests; Phase 5 adds 22 focused tests in `tests/appointments.test.tsx`. After those pass, use a running API and test-owner/test-veterinarian accounts to exercise the real booking and transitions (including overlap conflict and authorization). These end-to-end actions are **not** proven by unit tests or the production build alone.
