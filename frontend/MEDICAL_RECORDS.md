# PawCare web — Medical Records & Vaccinations (Phase 3)

## Backend contract

The Owner `/pets/[id]` page reads `GET /api/v1/pets/{petId}/medical` through the existing server-side API proxy. Only the authenticated owner (or an eligible veterinarian through the existing backend appointment check) can access the endpoint. The owner UI writes via:

- `POST /api/v1/pets/{petId}/medical/vaccinations`: `vaccineName`, `administeredAt` (ISO timestamp), nullable `nextDueAt`.
- `POST /api/v1/pets/{petId}/medical/medications`: `medicationName`, `dosageText`, `startAt` (ISO timestamp), nullable `endAt`.

The timeline query has been extended **without a schema migration** to include optional `nextDueAt`, `dosageText`, and `endAt` values for owners only. These newly added detail fields are redacted from veterinarian-role responses until the consent policy is implemented. Existing `type`, `title`, `occurredAt`, and `id` fields are unchanged. Authorization predicates and the 100-record limit remain unchanged.

Forms enforce required fields, Oracle `VARCHAR2(... BYTE)` maximums, valid local datetimes, strict next-dose ordering, and end-after-start ordering. Dates are sent as UTC ISO timestamps; no vaccine or dosage recommendations are generated.

The existing backend does not offer medical record edit/delete operations or full document/file upload. The new UI intentionally does not invent those endpoints. Archived pets remain read-only. The veterinarian `/vet/records/[id]` placeholder remains unchanged pending its separate record-access and consent requirements.

## Smoke test

1. From `frontend/`: run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Run the ASP.NET Core API with the authenticated Oracle database. Sign in as an Owner with an ACTIVE pet.
3. Open `/pets/<id>`, add a historical vaccination with a later next due date, then add a medication using recorded prescription instructions.
4. Refresh the page; check both types, dates, next due, and recorded dosage in the timeline.
5. Test the filtered view, search, invalid date messages, and errors when the API is unavailable.
6. Check that an archived pet does not expose add/edit actions.

The Phase 2 Windows baseline is 79/79 frontend tests and 19/19 Oracle integration tests. Phase 3 changes medical-query output and frontend code; those historical results are not a substitute for running the current suite or live API tests.
