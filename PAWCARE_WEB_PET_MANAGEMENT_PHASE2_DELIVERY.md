# PawCare Web — Phase 2: Pet management

## Baseline
This full source ZIP extends `PawCare_Complete_Project_Web_Auth_Phase1_20261107.zip`. The Phase 1 auth source, mobile app, backend, Oracle schema/migrations, and integration tests are unchanged.

## Changes
- Replaced a mistaken duplicate of the pet-detail page at `/pets` with an actual SSR-initialized owner pet directory.
- Added search by name/species/breed, retry/refresh handling, initial empty state, and an add-pet form.
- Implemented `POST /api/v1/pets` and `PATCH /api/v1/pets/{id}` clients using **the actual backend record contracts**. The create request includes the mandatory `sex` enum; edit does not send immutable species/sex.
- Preserved existing `attributesJson` and date of birth in edit PATCH requests, rather than clearing them as the earlier form would do.
- Added form validation for required fields, Oracle UTF-8 byte lengths (name 120, species 80, breed 120), sex, and birth-date validity.
- The pet-detail page now displays profile facts, care history, medical forms, navigation links, and archive controls.
- Implemented safe archive via **DELETE `/api/v1/pets/{id}`** (the backend performs a soft archive). Confirmation requires typing the pet name; active-listing conflicts remain enforced by Oracle/API.
- After edit/vaccination/medication changes, uses `router.refresh()` to refresh server-rendered details and history.
- Added `frontend/tests/pets.test.tsx` with create/edit payloads, filtering, failures, and archive behaviors.

## Files added
- `frontend/lib/pets/payloads.ts`
- `frontend/components/pets/PetProfileForm.tsx`
- `frontend/components/pets/ArchivePet.tsx`
- `frontend/components/features/PetManagementWorkspace.tsx`
- `frontend/tests/pets.test.tsx`
- `frontend/PETS.md`

## Files modified
- `frontend/app/(owner)/pets/page.tsx`
- `frontend/app/(owner)/pets/[id]/page.tsx`
- `frontend/components/features/PetProfileEditors.tsx`
- `frontend/app/globals.css`

## Validation performed in this environment
- **PASS** TypeScript transpilation/syntax and local import resolution: 121 `.ts`/`.tsx` files.
- **PASS** 11 independent runtime assertions for the pet request payloads (compiled TypeScript).
- **PASS** Comparison to Phase 1 ZIP: all 443 baseline files present; only 4 intentional changes plus 7 new files (including this document and frontend/PETS.md).
- **NOT RUN:** `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` in the container (package installation timed out). These must be run on a Windows machine with dependencies, as with the successful Phase 1 run.
- **NOT RUN:** Live ASP.NET/Oracle end-to-end pet CRUD tests. The backend and database were not modified or connected to.

## Windows test commands
From the updated source folder, run:

```powershell
Set-Location .\frontend
npm ci
npm run typecheck
npm test
npm run build
```

For interactive owner testing, run the ASP.NET API and Next.js frontend per the existing READMEs, sign in as an OWNER, and open `/pets`. Verify create, edit, vaccination, medication, search, and archive, including the blocked-active-listing case. Do not run migrations again.

## Important
Do not replace a newer working project without taking a backup. This ZIP contains the complete source tree *as it existed at the Phase 1 baseline*, plus Phase 2 changes. It deliberately excludes node_modules, build outputs, local credentials, and database data/backups.
