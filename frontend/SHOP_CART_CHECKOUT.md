# Phase 9 — Food Catalog, Cart & Checkout

This module uses existing Oracle-backed endpoints. No schema changes, backend changes, payment integrations, or new npm dependencies.

## Public store
- `GET /shop/products` and `GET /shop/categories` populate the `/shop` product list.
- Search, species/category, stock and sort run client-side on the latest API result (up to 100 active products).
- `GET /shop/products/{id}` returns title, description, brand, ingredients, allergens, weight, price, currency, and stock.
- Out-of-stock items cannot be added; stock is authoritative at checkout.

## Cart & checkout
- `PUT /cart/items` accepts `{productId, quantity}`; quantity 0 removes an item and 1..999 updates it.
- `GET /cart` powers item totals grouped by currency and quantity controls. Checkout is blocked locally for mixed currencies, matching backend policy.
- `GET /users/me/addresses` lists user shipping addresses. Billing addresses are excluded from checkout.
- `POST /checkout` accepts `{shippingAddressId}` with a cryptographically random `Idempotency-Key`; retries retain the same key for the same address.
- Checkout returns an order identifier used to navigate to `/orders/{id}`.
- Checkout creates an **unpaid** order and stock reservation. Payment processing is not implemented or claimed. The backend handles all final quantity/stock/price checks.

## Verification on Windows
Run from `PawCare/frontend`:

```powershell
npm run typecheck
npm test
npm run build
```

Browser-to-Oracle end-to-end testing is separate from the frontend test suite.
