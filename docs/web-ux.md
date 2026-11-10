# PawCare — Web UX Specification

> **Status:** proposed web experience for implementation; not a report of existing screens.  
> **Stack:** Next.js 16 App Router + TypeScript. Route groups such as `(public)` are filesystem grouping only and **do not** appear in URLs.

## 1. Product design goals

The PawCare website serves two complementary experiences:

- **Public discovery:** trustworthy browse/search pages for adoption, lawful pet-sale listings, lost/found notices and pet food.
- **Authenticated workspaces:** owner care and records, veterinarian consultation workflows, seller/listing management and administrator review.

Desktop screens optimize multi-record analysis and data entry; mobile web preserves browsing/checkout/accessibility without replicating every native-app interaction. The shared API remains the sole authority for permissions, availability, pricing and status changes.

## 2. Route map and page files

| URL(s) | File under `frontend/app/` | Audience / main action |
| --- | --- | --- |
| `/` | `(public)/page.tsx` | Home, product navigation, trust overview |
| `/adopt`, `/adopt/[id]` | `(public)/adopt/{page.tsx,[id]/page.tsx}` | Discover approved rehoming listings; apply after sign-in |
| `/marketplace`, `/marketplace/[id]` | `(public)/marketplace/{page.tsx,[id]/page.tsx}` | Discover approved animal listings; inquire after sign-in |
| `/lost-found`, `/lost-found/[id]` | `(public)/lost-found/{page.tsx,[id]/page.tsx}` | Redacted reports; authenticated sightings |
| `/shop`, `/shop/[slug]` | `(public)/shop/{page.tsx,[slug]/page.tsx}` | Food catalogue and product detail |
| `/login`, `/register`, `/forgot-password` | `(auth)/.../page.tsx` | Account entry/recovery |
| `/dashboard`, `/pets`, `/pets/[id]` | `(owner)/.../page.tsx` | Pet records, timeline and documents |
| `/care`, `/appointments`, `/expenses` | `(owner)/.../page.tsx` | Care, veterinarian bookings, spending |
| `/my-adoptions`, `/my-listings`, `/my-reports` | `(owner)/.../page.tsx` | Adoption applications/posts, pet-sale inquiries, lost/found reports |
| `/cart`, `/checkout`, `/orders`, `/orders/[id]` | `(owner)/.../page.tsx` | Food orders and fulfillment |
| `/favorites`, `/notifications`, `/profile` | `(owner)/.../page.tsx` | Saved content, alerts, account |
| `/vet`, `/vet/appointments`, `/vet/records/[id]` | `(vet)/.../page.tsx` | Vet queue, consultation notes |
| `/admin`, `/admin/users`, `/admin/moderation` | `(admin)/.../page.tsx` | Operations and safety review |
| `/admin/verification`, `/admin/catalog`, `/admin/inventory`, `/admin/orders`, `/admin/reports` | `(admin)/.../page.tsx` | Seller/vet approval, food store operations, audit reporting |
| `/api/auth/[action]`, `/api/relay/[...path]` | `api/.../route.ts` | Server-side web session operations and relay; not browser-managed API secrets |

Add `loading.tsx`, `not-found.tsx`, and appropriate `error.tsx` boundaries as screens are built. App Router groups can each provide a layout that wraps their route family.

## 3. Navigation and information architecture

### Public header

`PawCare logo | Adopt | Marketplace | Lost & Found | Food Store | Search | Sign in / Account`

- Clearly distinguish **adoption/rehoming** from **paid animal listings** using labels, not only styling.
- Keep public item information minimal and approved; do not expose full owner profile, exact location, documents or contact details.
- Provide trusted safety guidance from item details; users can report suspicious content.

### Owner workspace

Left desktop sidebar: `Overview, My Pets, Care, Vet Visits, Expenses, My Adoptions, My Listings, My Lost/Found Reports, Food Orders, Saved, Settings`. Use nested items for low-frequency tasks. Top bar: pet switcher, global search (scoped by permissions), alerts, user menu.

### Vet workspace

`Daily Queue, Calendar, Assigned Pets / Records, Visit Notes, Profile` with clearly visible appointment dates and assignments. No unrestricted lookup of medical records.

### Admin workspace

`Overview, Moderation, Verifications, Users, Catalogue, Inventory, Orders, Audit/Reports`. Advanced administrative operations are desktop-first with searchable tables and documented confirmation dialogs.

## 4. Core page and component patterns

| Component / screen | Design standard |
| --- | --- |
| Cards (pet, adoption, sale, lost, product) | Consistent image size, one clear primary action, meaningful status + trust badge |
| List and results | Search, filters, sort, pagination; URL query reflects state; empty-results reset link |
| Data tables | Sticky header where helpful, keyboard-operable sort, semantic table markup, scoped bulk actions |
| Forms | Field labels, inline help, server+client validation, preserved draft on failure |
| Timeline | Chronological entries with author and timestamp; document attachments gated |
| Calendar | Accessible date/time selection, user's time zone, unavailable slots not selectable |
| Detail page | Basic information first; visible safety/verification policy; progressively disclose longer content |
| Cart/checkout | Server-calculated totals, shipping address, cost breakdown, payment state, idempotent submit |
| State badge | Text in addition to color; clear definitions of DRAFT/REVIEW/ACTIVE/COMPLETED |
| Media uploader | Accept approved types, size check, image preview, upload progress, cancel/retry, privacy guidance |

Suggested shared source paths:

```text
frontend/components/
├── layout/{AppShell,Sidebar,Topbar}.tsx
├── ui/{Button,FormField,Modal,EmptyState,ErrorState,DataTable,StatusBadge,ImageUploader}.tsx
├── pets/{PetCard,HealthTimeline}.tsx
├── appointments/VisitCalendar.tsx
├── adoption/{AdoptionCard,ApplicationForm}.tsx
├── marketplace/{SaleListingCard,InquiryPanel}.tsx
├── lost-found/{LostPetCard,SightingForm}.tsx
├── shop/{ProductCard,CartSummary,CheckoutForm}.tsx
└── admin/ModerationQueue.tsx
```

## 5. User journeys

### Pet owner dashboard

After login, show: selected pet, care due today, vaccination/medication follow-up, next appointment, cost summary and alerts. Each card links directly to its detail or action. No misleading demo counts on real accounts.

### Adoption and animal donation

1. Public visitor filters approved adoption listings; listing details use generalized region.
2. Signed-in owner creates draft, submits required welfare details and media, then sees `PENDING_REVIEW`.
3. Admin approves or rejects with a reason. Only approved items are public.
4. Applicant signs in and submits application, sees status without other applicants' data.
5. Poster reviews applicants privately; selected adopter follows safe handover flow.
6. Both parties confirm; backend updates the pet owner and audit history atomically.

**Monetary donation campaigns** are a separate optional future workflow: verified beneficiary, transparent campaign purpose and payment/refund rules. Do not create a generic “Donate” button that silently charges users.

### Pet sale marketplace

Seller applies for approval, creates listing with permitted species/age and evidence, undergoes moderation, then receives inquiries and agrees on an in-person handover. Keep sale states distinct from food orders. Disclose any fees and verify local animal-sale legality before launch. There is **no live-animal shipment** action.

### Lost/found

Cards show species, description, **approximate** last-seen area, date, safe image and status. Details include a **Report sighting** action for signed-in users; private evidence and contact exchanges require authorization and consent. Do not provide exact home pins, public phone numbers or publicly downloadable proof photos.

### Food store

Product/category pages show price in ISO currency, unit size, ingredients/food details as supplied, availability and return policy. Cart edits reprice server-side. Checkout collects validated shipping details and displays complete totals; a successful click does not imply payment is complete until confirmed by backend. Order detail shows tracking events and refund/support actions.

## 6. Responsive behavior

| Viewport | Navigation | Layout |
| --- | --- | --- |
| Small phone (< 640px) | Accessible menu/drawer; sticky meaningful action if needed | One-column cards/forms, no ordinary horizontal scroll |
| Tablet (640–1023px) | Compact sidebar/drawer | 2-column cards; data grids scroll only when unavoidable |
| Desktop (≥ 1024px) | Persistent sidebar in protected app | Dense but readable tables, split-view details, larger calendars |

The figures above are design breakpoints, not a limitation of the framework. Test portrait/landscape and zoom/reflow at 200% and 400% where relevant. Never hide security or payment notices solely due to viewport width.

## 7. Web security and privacy UX

- Web sign-in uses a backend-mediated session and `HttpOnly` secure cookies; never print tokens into client components, URLs, logs or analytics.
- For cookie-authenticated mutations, apply appropriate CSRF protections; verify server auth and ownership at the ASP.NET API as well as in Next.js route handlers.
- Access-denied pages must not leak a private record title or owner identity; treat sensitive object enumeration as `404` when appropriate.
- Sensitive medical, lost-pet proof, adoption application and seller verification data must be `no-store` and require authorization. Public, approved, redacted discovery pages may use controlled revalidation.
- Admin actions show who/what is affected, require justification where necessary, and generate an audit event.

## 8. Accessibility, reliability and measurement

- Design target: WCAG 2.2 AA; test keyboard-only flows, visible focus, labels, error instructions, screen readers, zoom and reduced motion.
- Ensure user-friendly failure messages; include a copyable request ID in details if support needs it, but never expose IP addresses/secrets/stack traces.
- Measure search-to-detail success, pet creation completion, booking success, adoption application completion, mobile-web checkout abandonment, API error rate, load performance and moderation handling time.
- Do not set numerical SLO targets until representative baseline data exist; document them during production-readiness testing.

## 9. Web acceptance checklist

- [ ] Guest sees approved and redacted public listings; cannot view unpublished content.
- [ ] Owner can manage own pets and cannot access another owner's record by changing the URL.
- [ ] Vet can only view assigned records and appointments.
- [ ] Seller cannot self-approve; admin review decisions are auditable.
- [ ] Same order remains consistent on web and mobile.
- [ ] Desktop, tablet, phone, keyboard, screen reader and zoom journeys pass.
- [ ] All consequential forms support validation, pending/error states and replay-safe submission.

See [architecture.md](architecture.md), [mobile-ux.md](mobile-ux.md), [api-contracts.md](api-contracts.md), [permissions-matrix.md](permissions-matrix.md) and [acceptance-tests.md](acceptance-tests.md).
