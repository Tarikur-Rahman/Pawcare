# PawCare Web — Phase 9 delivery

Based on Phase 8 source and limited to product browsing, product details, cart and unpaid checkout.

### Changed
- `frontend/app/(public)/shop/page.tsx`: repair duplicate product-detail page and load real catalog/categories.
- `frontend/app/(public)/shop/[slug]/page.tsx`: detail attributes and stock-aware purchasing.
- `frontend/components/shop/ShopCatalog.tsx`: searchable/filterable/sortable product catalog.
- `frontend/components/shop/ProductCard.tsx`: prices and stock information.
- `frontend/components/features/ProductPurchase.tsx`: safe cart updates, quantity validation, errors and success states.
- `frontend/components/features/CartWorkspace.tsx`: robust owner cart with quantity updates, removal and safe checkout gate.
- `frontend/components/shop/CartSummary.tsx`: totals separated by currency.
- `frontend/components/shop/CheckoutForm.tsx`: shipping-only address selection, cart review, stable idempotency, unpaid checkout.
- `frontend/lib/shop/catalog.ts`: pure API-boundary helpers.
- `frontend/app/globals.css`: targeted responsive styles.
- `frontend/tests/shop-cart-checkout.test.tsx`: focused automated tests.
- `frontend/SHOP_CART_CHECKOUT.md`: behavior and verification notes.

### Unchanged
ASP.NET backend, Oracle migrations V001–V013, database metadata/seed data, other frontend modules, mobile source and npm package versions.

### Validation
Static TypeScript checks and ZIP integrity are performed in the delivery environment. Full npm/Vitest/Next.js tests must run on the user's Windows system if the runner cannot be installed in this offline container.
