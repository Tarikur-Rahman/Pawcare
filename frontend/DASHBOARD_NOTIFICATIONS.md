# PawCare Phase 7 — Dashboard & Notifications

This release updates the existing Next.js 16 owner dashboard and notification inbox, without changing the ASP.NET Core API, Oracle migrations, or Expo app.

## Existing backend routes used

- `GET /api/v1/reports/dashboard` — `petCount`, `pendingTasks`, `upcomingVisits`, `unreadNotifications`.
- `GET /api/v1/pets` — owner pet summary.
- `GET /api/v1/appointments` — owner/vet visit preview.
- `GET /api/v1/notifications` — latest 100 notifications (`id`, `kind`, `title`, `body`, `createdAt`, `readAt`).
- `POST /api/v1/notifications/{id}/read` — mark notification read; expects 204 No Content.

The frontend uses the existing session-aware server proxy and browser relay. No custom database or new API surface was introduced.

## Improvements

- Owner dashboard no longer shows a fabricated zero-valued **Orders** KPI. It now shows the actual unread-notification total from the report API.
- Separately reports temporarily unavailable dashboard sources as **—** rather than false zero values.
- Shows active companions, a short list of valid upcoming appointments, and a short list of unread updates.
- Keeps veterinarian and admin dashboard entry points and links intact.
- Notification inbox has explicit read/unread status, summary totals, filter, search, refresh, and retryable errors.
- Mark-read action only updates local presentation after the existing API reports success; rejects malformed identifiers and overlapping changes.
- Client and server previews are bounded; lists do not imply that all historical records have been retrieved.

## Validation

New test file: `frontend/tests/dashboard-notifications.test.tsx` (20 Vitest cases). Includes dashboard summaries, appointment preview ordering, notification filters, mark-read success/failure, and unavailable states.

On Windows, with the updated full source installed:

```powershell
Set-Location 'C:\Users\Tarik\OneDrive\Documents\PawCare\frontend'
npm run typecheck
npm test
npm run build
```

Expected frontend test count: **178**, if all 158 Phase 6 tests remain green plus the 20 new cases. The environment producing this ZIP could run syntax, import, and dependency-free assertions but lacked the packages to run the actual Vitest/Next.js commands. Your Windows results are the authoritative build/test checkpoint.

**Operational reminder:** The notification inbox displays records returned by Oracle; notification generation and delivery still require the configured backend workers. A scheduled care task is not a guarantee that an in-app notification was delivered.
