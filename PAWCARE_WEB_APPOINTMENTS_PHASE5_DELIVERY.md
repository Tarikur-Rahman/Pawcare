# PawCare — Web Phase 5 delivery: Veterinary appointments

The existing Phase 4 source archive is the immutable starting point for this release. This phase replaces the basic booking page with a role-aware appointment workspace and a validated booking form, adds pure request/status helpers, focused tests, responsive styles, and developer documentation. Only frontend files are changed.

Changes: `frontend/components/features/BookingWorkspace.tsx`, `frontend/components/appointments/AppointmentBookingForm.tsx`, `frontend/lib/appointments/booking.ts`, `frontend/tests/appointments.test.tsx`, `frontend/app/globals.css`, and `frontend/APPOINTMENTS.md`.

Run from `PawCare/frontend`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. See `frontend/APPOINTMENTS.md` for the live API validation checklist.

**Security / safety:** all mutations remain enforced by the existing owner/vet authorization policies and database guards. No free-slot claims are made before the API accepts the request. No Oracle migrations, backend services, or worker switches are touched.
