# PawCare Web Phase 13 — Pet Marketplace

## Verified baseline
Phase 12 passed 348/348 Vitest tests on Windows. TypeScript check and Next.js production build passed before the test-only Phase 12 patch; the patch did not alter production code.

## Phase 13 changes (web frontend only)
- Fix `/marketplace` to fetch `GET /api/v1/marketplace/pets` and show a searchable, species-filtered approved listing catalog; never confuse catalog with a detail page.
- Harden `/marketplace/[id]` to allow only positive safe Oracle IDs, show available public data and asking amounts, and offer inquiry-only actions. No live animal checkout or sale is exposed.
- Seller-only draft workflow (`/my-listings`) using `POST /marketplace/pets`: active owned-pet selection, title/description/general area, **askingMinor** as whole integer minor units, uppercase ISO currency, and an already approved, owned SAFE/REVIEWER_ONLY welfare file ID. Media uploads start PRIVATE/PENDING_SCAN and are **not** auto-approved as evidence. Server enforces the approved-seller capability and evidence policy.
- Explicit separate `POST /marketplace/pets/{id}/submit` for moderator review, not public posting.
- Private inquiry form (`POST /marketplace/inquiries`) with only `{listingId, message}` and strict 5–2000 UTF-8-byte validation; no payment claim.
- Private sent/received inquiry history (`GET /marketplace/inquiries`) with local filters, search, refresh, and separate loading/empty/error states. Server authorization determines what the user can see.
- 39 new focused tests in `frontend/tests/marketplace.test.tsx` (baseline 348 → expected 387 tests).

## Contract and limitations
- The backend has no seller-only draft history endpoint; users should retain draft IDs.
- Pet sales endpoint is explicitly disabled by the backend. Payment, animal checkout, shipping, ownership transfer, staff moderation actions, private identities, and seller capability assignment are not implemented here.
- Listing prices are displayed with their own currency. Sorting groups by currency; no exchange-rate conversion or cross-currency monetary totals.
- No backend, Oracle, or mobile source files were changed.

## Validation
- TypeScript/TSX syntax parse and local import resolution: PASS (performed without installing dependencies).
- Dependency-free marketplace contract assertions: PASS.
- ZIP CRC and byte-for-byte preservation of backend, database and mobile: checked at packaging.
- Full Vitest and Next.js production build: **PENDING** (npm offline install cannot retrieve xmlchars 2.2.0).

### Windows acceptance
From `C:\Users\Tarik\OneDrive\Documents\PawCare\frontend`, after applying the updated files:

```powershell
npm run typecheck
npm test
npm run build
```

Expected total: **387 tests**. Do not consider Phase 13 verified until these commands pass.
