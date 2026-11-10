# PawCare web — Phase 10: order history and details

- Owner route `/orders`: private GET `/api/v1/orders`, 100 most recent orders, status grouping, search and local filters. `orders` is not the veterinarian or administrator-wide listing.
- Owner route `/orders/[id]`: server-authenticated GET `/api/v1/orders/{id}`, limited to the signed-in user. Invalid and unsafe IDs are rejected before use.
- Cancellation: POST `/api/v1/orders/{id}/cancel` only for `PLACED`, with explicit in-page confirmation. Success is reflected only after a successful response. The backend also rejects cancellation when payment processing exists.
- Shipment detail: GET `/api/v1/orders/{id}/shipments/` for shipped/delivered orders, with independent loading/error/refresh states. No outbound carrier URL is invented.
- The current order API does **not** return per-line item details, payment transactions or address snapshots in the order-detail response. These are explicitly not represented in UI.
- No database migrations, Oracle schema updates, mobile application changes or backend source edits were made.

## Windows verification

From `PawCare\frontend`: `npm run typecheck`, `npm test`, `npm run build`. Expected: 277 tests (247 from Phase 9 plus 30 new).
