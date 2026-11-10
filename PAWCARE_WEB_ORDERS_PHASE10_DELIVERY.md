# PawCare Phase 10 — Orders & Order History

The verified Phase 9 source is preserved with targeted frontend updates: corrected `/orders` route, new searchable history, owner-scoped details, conditional server-confirmed cancellation, and shipment tracking when available.

New test file: `frontend/tests/orders.test.tsx` (30 new tests; expected frontend total: 277).

**Validation:** typechecking, Vitest, and production build must be verified on Windows. Static checks do not replace full integration testing. All order and shipment data is retrieved from the existing ASP.NET Core/Oracle backend. No schema change.
