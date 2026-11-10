# PawCare Web — Phase 11: Adoption Management

Baseline: Phase 10 full project (`PawCare_Complete_Project_Web_Orders_Phase10_20261108.zip`).

## Scope

- Replace the incorrectly duplicated adoption-detail implementation at the public `/adopt` route with a public catalog backed by `GET /adoptions`.
- Search and filter published listings by headline, species, description, and general area; retain public details, favorite, and report actions on `/adopt/[id]`.
- Private adoption applications: trim answers; enforce minimum 10 characters and maximum 4,000 UTF-8 bytes; only mark successful submission after the API confirms it.
- Owner draft editor: load only active pets, validate all text with backend UTF-8 limits, create a private draft (`POST /adoptions`) and explicitly submit it to moderation (`POST /adoptions/{id}/submit`).
- Owner application review, guarded accept/reject decisions (only SUBMITTED applications), and explicit dual-party handover confirmation using the backend's existing endpoints.
- Preserve API permission boundaries: unpublished adoption history and applicant-side application-status retrieval are NOT exposed by the current backend; no invented private histories or ownership transfers.

## Contract and safety

Adoption draft fields: `{petId:number,title:string,description:string,generalArea:string}`. Applications: `{answers:string}`. Decision: `{accept:boolean}`. Handover: `POST /adoptions/{id}/handover` with `Idempotency-Key` header and no invented payload. All paths use validated positive safe-integer IDs. Handover key is a cryptographically random 32-hex-character token, held across retries for the same listing. A handover response of `AWAITING_OTHER_PARTY` is not treated as a transfer; only a backend `COMPLETED` response permits showing ownership-transfer success.

No backend, Oracle migration, or mobile source changes were made.

## Verification

- New `frontend/tests/adoption.test.tsx`: 34 tests spanning contract normalization, public catalog, application, draft, owner decisions, and handover.
- Dependency-free TypeScript/TSX parser and local-import checks, plus 28 core runtime assertions, run in the preparation environment.
- Full frontend `npm run typecheck`, `npm test`, and `npm run build` must be run in the Windows project after extraction. Expected total: 311 tests (previously passing 277 + 34).
- Full Vitest execution unavailable in packaging environment: offline npm cache does not contain `xmlchars@2.2.0`. No build/test success claim is made for the full suite until Windows verification.

## Validation from Windows

```powershell
Set-Location 'C:\Users\Tarik\OneDrive\Documents\PawCare\frontend'
npm run typecheck
npm test
npm run build
```

The non-blocking Vite native config loader warning is unchanged.
