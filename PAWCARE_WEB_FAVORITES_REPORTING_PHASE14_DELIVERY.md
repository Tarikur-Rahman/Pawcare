# PawCare Phase 14 — Favorites & Content Reporting

## Scope
- Authenticated favorites list with typed safe links to ADOPTION, PET_SALE, LOST_FOUND, and FOOD_PRODUCT detail routes.
- Local list filtering, refresh/retry, genuine empty vs unavailable states, explicit removal confirmation, and deletion only after success from the existing API.
- Detail-page FavoriteButton reconciles backend state (`GET /favorites`) and uses the **favorite ID** for deletion, never the listing ID. Backend-confirmed POSTs are not treated as a new ID until refreshed.
- Private listing concerns: reason code allowlist, Unicode-aware 3000-byte detail limit, exact request contract to POST `/reports/listings`, visible API failures, and receipt as pending review (not an approval/removal).
- All IDs are constrained to positive safely representable integers before URL or payload construction.

## Unchanged
Backend ASP.NET Core, Oracle migrations/schema, mobile application, dependency manifests, and prior web modules are unchanged.

## Windows verification
From `PawCare/frontend`, run `npm run typecheck`, `npm test`, and `npm run build`. Phase 13 baseline: 387 passing frontend tests. Phase 14 adds 33 tests; expected 420 total. The test runner and production build require Windows confirmation; the packaging environment lacks a full npm dependency cache.

## API capabilities / limitations
`GET/POST /favorites`, `DELETE /favorites/{favoriteId}`, and `POST /reports/listings` are supported. There is no user-facing listing-report history endpoint, so the UI does not fabricate one. The report creation response is a receipt in OPEN review state and does not imply moderators have resolved a concern.
