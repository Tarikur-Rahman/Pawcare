# PawCare Web Phase 6 — Expense Tracking

**Baseline:** Phase 5 test-fix source ZIP. **Scope:** Next.js 16 owner expense management. No API or Oracle migration changes.

## Implemented

- Per-active-pet expense list (backend returns the latest 100 records).
- Create and update records with the existing `POST /pets/{petId}/expenses` and `PATCH /expenses/{id}` APIs.
- Major-to-minor-unit conversion without floating point rounding for two-decimal currencies (BDT, USD, EUR).
- Exact validation of non-negative minor amounts, ISO timestamps, supported categories and UTF-8 note length.
- Expense list search and category filters, async error/retry/loading behavior and successful-save refresh.
- Per-pet displayed totals based on the 100 returned entries; independent all-pets lifetime totals per currency using `GET /reports/expenses`.
- Explicitly no deletion button: this API has no expense deletion endpoint.

## Important contract notes

- The API supports any three-letter uppercase currency, but this UI deliberately offers only BDT, USD and EUR because the backend `amountMinor` field has no currency-specific decimal precision metadata. Do not add zero- or three-decimal currencies without implementing the appropriate scale.
- A total from the latest 100 pet transactions is not an all-time total. All-pet lifetime totals use the existing reporting API and remain split by currency.
- Existing API ownership guards and active-pet checks are respected; the frontend does not bypass them.
- Source-only/React tests are in `frontend/tests/expenses.test.tsx`.

## Windows validation

Run from `PawCare/frontend`:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

The previous test suite contained 137 cases. This phase adds 21 expense cases (expected total: 158). Browser-to-Oracle end-to-end testing still requires a configured, running API.
