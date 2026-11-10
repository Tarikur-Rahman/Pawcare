# PawCare — Phase 4: Care Schedules & Reminders

Baseline: `PawCare_Complete_Project_Web_Medical_Phase3_20261107.zip` (Phase 3).
This archive is the full updated source project, not a patch. No Copilot required.

## Scope of the change

- Rebuilt the existing owner-only `/care` page around the established Oracle-backed API.
- Load active owner pets and accept a pet preselection with `/care?petId=<pet-id>`.
- Create care tasks using the exact backend fields: `type`, `title`, `dueAt` (ISO-8601 UTC) and optional `recurrenceRule` (`DAILY`, `WEEKLY`, `MONTHLY`, or null).
- Validate strict local wall-clock date/time, future due time, required title, allowed types, and 160-byte UTF-8 title limit before POST.
- Filter tasks by pending, overdue, completed and cancelled; search, sort, show an upcoming/overdue summary, and refresh.
- Complete a pending task via `POST /tasks/{id}/complete` and cancel via `POST /tasks/{id}/cancel`, with separate confirmation and correct error reporting. No update of settled tasks.
- Read recent **delivered** `CARE_REMINDER` notifications on demand through existing `/notifications`, with unread/read state. This is not an outbox/worker status indicator.
- Handle API error/retry, stale selection requests, empty states and disabled/busy actions. Archive-pet creation is not presented.
- Link from `/pets/[id]` into care page with that pet selected.
- Add 18 focused frontend tests (`frontend/tests/care.test.tsx`).

## Files changed or added

- `frontend/components/features/CareWorkspace.tsx` — replaced old care UI.
- `frontend/components/care/CareTaskForm.tsx` — new validated create form.
- `frontend/components/care/CareReminderPanel.tsx` — delivered in-app reminders only.
- `frontend/lib/care/tasks.ts` — pure validation, due status, filter and sort helpers.
- `frontend/tests/care.test.tsx` — 18 regression tests.
- `frontend/app/(owner)/pets/[id]/page.tsx` — scoped link.
- `frontend/app/globals.css` — responsive care dashboard styles.

## Reminder behavior and limitations

This phase does not claim that creating a care task immediately delivers a notification.
The existing `ReminderWorker` and `OutboxWorker` are **off by default** and must be configured and operating to generate in-app reminders. Recurrences materialize into new task rows only after the source occurrence is completed **and** its due time has arrived, when `ReminderWorker` runs. The reminder process watches care tasks around their due time (30 minutes ahead, up to 15 minutes late); the outbox handler rechecks eligibility. A missed reminder window may not create a notification. No automatic email messages are sent by the reminder producer.

`GET /notifications` exposes only the most recent 100 notifications and does not include per-task delivery metadata, so this UI does not infer whether a task was queued, sent, or skipped. The on-demand panel shows at most five recent care notifications, not an exhaustive audit.

No backend C# source, Oracle migrations, seeds, schemas, or worker configuration changed in this phase.

## Validation

Performed in this build environment:
- TypeScript/TSX source parsing and local import resolution: PASS.
- Care payload/filter/status runtime assertions: 13 PASS.
- ZIP integrity and unchanged prior-phase source files: PASS (see delivery response).

**Not performed here**: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, live Oracle/API/browser tests. npm dependencies were unavailable in the build container. Do not treat parse checks as a production build.

On Windows, extract this archive into a *separate directory* (it contains a root `PawCare/` folder), then run from the extracted `PawCare/frontend` folder:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Expected Vitest total **115** (prior 97 + 18 new), if no other tests are added. A Vite native-config warning may appear; it was non-blocking in previous phases.

Optional manual backend/browser check (requires a running, configured API): log in as owner; open `/pets`, select a pet and follow Care tasks; create a future one-time task; create recurring task; filter and search; mark one complete; cancel another after confirmation; check `/notifications` if workers are enabled. Do not enable background workers or run migrations merely to test a frontend build.

## Release safety

Preserve your existing passing project. Do not overwrite it blindly. The previous authenticated Oracle suite was reported as 19/19 passed; this phase does not rerun Oracle validation and does not modify backend code.
