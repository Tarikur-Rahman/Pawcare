# PawCare Web — Phase 15: Administration & Moderation

## Baseline

Phase 14 Favorites & Content Reporting (corrected source). Windows-verified previous baseline: TypeScript checks, 420/420 Vitest tests, and Next.js production build all passed.

## Implementation

- `/admin` is a real operational landing page rather than an accidental duplicate of the product catalog.
- `/admin/users` lists the latest 100 users returned by the existing admin API, supports filtering/search, and requires an explicit identity-review attestation, audit reason, and second confirmation before requesting activation of an eligible pending owner.
- `/admin/verification` uses the exact server capability code `APPROVED_SELLER` (not `APPROVED_PET_SELLER`) and supports documented grants, revocations by verified grant ID, and verified reunion-claim actions. Each is submitted only after user confirmation. Evidence approval remains server-authoritative; an uploaded asset is not automatically approved.
- `/admin/moderation` separates content-report queue (`LISTING_REPORTS`) from listing-review decisions. Content report rows are informational, not directly approvable/rejectable through the current backend. Listing decisions require known listing type/ID, reason and confirmation; the backend validates current listing status and required safety evidence.
- `/admin/reports` correctly labels the existing *currency-aggregated* store report and includes `verifiedCapturedMinor` instead of a nonexistent day field. Placed orders are not presented as captured revenue.
- `/admin/catalog` describes that the public product query lists ACTIVE products only; new product drafts need STORE_OPERATOR permission and moderation.
- Reusable guard helpers and 36 new regression tests were added; no new network dependencies.

## Backend/API scope

Unchanged. Existing Oracle database/migrations, all ASP.NET Core services and React Native/Expo source are unchanged. This work deliberately does not create a public list of private reunion claims, capability grants, unpublished listings, or an administrative case-close endpoint for listing reports because those endpoints do not exist.

## Validation

Local checks: TypeScript/TSX syntax and local module references passed; 28 standalone JS contract assertions passed; ZIP CRC/integrity and unchanged backend/mobile/Oracle byte comparison checked.

Full Vite/Vitest and Next.js build still require execution in a Windows installation with frontend `node_modules`.

```powershell
cd "C:\Users\Tarik\OneDrive\Documents\PawCare\frontend"
npm run typecheck
npm test
npm run build
```

Expected frontend test total: **456** (prior 420 + new 36). This is an *expected count*, not a claim that the new tests passed.
