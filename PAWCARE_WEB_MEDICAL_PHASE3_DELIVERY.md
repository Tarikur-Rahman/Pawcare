# PawCare — Phase 3: Web Medical Records & Vaccinations

## Source baseline

Full source archive from **PawCare_Complete_Project_Web_Pet_Management_Phase2_20261107.zip**, the Phase 2 package that passed 79/79 Vitest tests, TypeScript, and Next.js build on Windows. The Oracle backend previously passed 19/19 authenticated integration tests.

## Scope of changes

- `frontend/components/pets/MedicalRecordsWorkspace.tsx` — client medical history, counts, filter, search, refresh, and archived-pet readonly behavior.
- `frontend/components/pets/MedicalRecordForm.tsx` — purpose-built vaccination and medication entry forms using the existing authenticated API relay.
- `frontend/lib/medical/records.ts` — exact backend request payloads and local datetime/Oracle byte-length validation.
- `frontend/components/pets/HealthTimeline.tsx` — vaccination due dates, prescribed medication instructions, medication end dates, and collision-safe event keys.
- `frontend/components/features/PetProfileEditors.tsx` — single pet editor; avoids duplicate medical entry forms.
- `frontend/app/(owner)/pets/[id]/page.tsx` — integrates medical workspace while retaining profile details, archive flow, and quick links.
- `frontend/app/globals.css` — responsive styling.
- `backend/PawCare.Api/Modules/Medical/MedicalRepository.cs` — additive timeline fields (`nextDueAt`, `dosageText`, `endAt`) for owners, redacted for veterinarian roles. Existing authorization, writes, ordering, and 100-row cap retained.
- `frontend/tests/medical.test.tsx` — 18 regression tests (payloads, invalid dates, bounds, UI flow, search, readonly and errors).
- `frontend/MEDICAL_RECORDS.md` — contracts, permissions, smoke testing, and limitations.

**Unchanged:** Oracle SQL schema, V001–V013 migrations and checksum records, other backend modules, Phase 1 authentication, Phase 2 pet management, and mobile app.

## Verification performed in this environment

- All 126 frontend TypeScript/TSX source files parsed successfully.
- 299 local imports resolved.
- 12 independently executed JavaScript runtime assertions for medical payload and filtering logic passed.
- Additive backend SQL structure and existing authorization predicate checked statically.
- Full archive integrity and baseline preservation checked before delivery.

### Not independently executed here

npm dependencies were unavailable in the current environment (npm installation failed). Therefore **the new 18 Vitest tests, a true TypeScript typecheck, the Next.js build, .NET build, and live Oracle medical API queries have not been executed here**. Previously passed Phase 2 and Oracle results are **historical baselines**, not Phase 3 passing results.

## Windows verification

Extract into a **separate directory** before replacing the existing PawCare folder.

In the extracted project root, run:

```powershell
Set-Location .\frontend
npm ci
npm run typecheck
npm test
npm run build
Set-Location ..
dotnet build .\backend\PawCare.Api\PawCare.Api.csproj -c Release --no-restore
```

The expected total is **97 frontend tests** (79 previous + 18 new), provided all tests pass. Once builds pass, run `./scripts/run-oracle-backend-validation.ps1` from the project root to verify the live Oracle integration suite, then perform a manual owner workflow as described in `frontend/MEDICAL_RECORDS.md`.

## Current API limitations

Medical entries are **append-only** through the existing endpoints: no edit/delete feature exists. Record files, attachments, and veterinarian consent-based access are not implemented in this phase. Do not expose the VET records screen until authorized vet consent/access requirements are implemented separately. PawCare does not generate medical recommendations or dosage instructions.
