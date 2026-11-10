# PawCare — REST API Contracts (v1)

> **Contract status:** proposed, not implemented or generated from running code.  
> **Canonical base path:** `/api/v1` | **Health endpoint:** `/api/health` (unversioned).  
> **Source of truth:** backend OpenAPI generated from .NET implementation; generated TypeScript types in `packages/api-contracts/`.

## 1. Global conventions

- JSON over HTTPS in production; `Content-Type: application/json; charset=utf-8`. Multipart media upload is a separate controlled route.
- Route IDs are opaque strings in clients, backed by SQL integer or UUID as the schema decides. Clients must not infer ownership from an ID.
- Timestamps: ISO 8601 UTC (e.g. `2026-11-05T08:00:00Z`). Display dates in user's time zone; retain UTC on the wire.
- Money: `{ "amountMinor": 159900, "currency": "BDT" }`, never float currency arithmetic. Exact currency-specific minor-unit scale must be defined centrally.
- Status values are uppercase enums. All changes follow documented transition rules.
- List pagination: `page` (1-based), `pageSize` (bounded), `total`. Use stable sort, usually `createdAt DESC` plus ID tie-breaker.
- All responses carry/identify `requestId`; log it without leaking private information.
- Mutations require authentication, authorization and appropriate ownership/assignment checks unless explicitly marked public.

### Response envelopes

Single object success:

```json
{
  "data": {
    "id": "pet_123",
    "name": "Buddy",
    "species": "DOG"
  },
  "requestId": "req_abc123"
}
```

Paginated collection success (a *top-level list* envelope, following the rebuild blueprint):

```json
{
  "items": [{ "id": "ad_20", "status": "PUBLISHED", "generalArea": "Dhaka" }],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "requestId": "req_abc124"
}
```

Error envelope:

```json
{
  "code": "LISTING_NOT_APPROVED",
  "message": "This listing is not available.",
  "fieldErrors": {},
  "requestId": "req_abc125"
}
```

Status: `200` read/update; `201` create (with `Location` where appropriate); `202` asynchronous accepted; `204` no body; `400` malformed request; `401` missing/expired login; `403` authenticated but disallowed; `404` not found or private/unpublished resource; `409` state/concurrency conflict; `422` business validation; `429` rate limited; `5xx` internal/availability. Use one canonical validation strategy and document consistency exceptions.

### Authentication and safe retries

- API auth: `Authorization: Bearer <access-token>` for mobile and direct API clients. Web server relay uses secure cookie session and appropriate CSRF protections.
- Issue short-lived access credentials and rotate/revoke refresh credentials; never log tokens.
- `Idempotency-Key` header is required for `POST /checkout`, `POST /.../handover`, `POST /marketplace/sales` and donation/payment-intent operations. Scope key to `(user, operation)` plus request-body hash; duplicate same request returns original outcome, mismatched payload receives `409`.
- `ETag` / `If-Match` or a `version` field is recommended for mutable listings, cart edits and approval decisions. Clearly return `409` when stale.
- GETs do not mutate state; no untrusted caller can force internal status transitions by PATCHing a whole record.

## 2. Route catalogue

`A` = authenticated; `O` = owner of record; `V` = assigned vet; `M` = admin/moderator; `S` = approved seller capability; `SO` = store operator capability; `P` = public **approved/redacted** data only. See [permissions-matrix.md](permissions-matrix.md) for full conditions.

### Identity / account

| Method | Path (relative to `/api/v1`) | Access | Semantics |
| --- | --- | --- | --- |
| POST | `/auth/register` | Guest | Create pending/active user based on verification policy |
| POST | `/auth/login` | Guest | Credentials -> safe session/token |
| POST | `/auth/refresh` | Refresh credential | Rotate session; revoke old refresh token |
| POST | `/auth/logout` | A | Revoke current session |
| GET | `/auth/me` | A | Safe caller profile, primary role + granted capabilities |
| POST | `/auth/forgot-password` | Guest | Generic success response; no account existence leak |
| POST | `/auth/reset-password` | Valid recovery credential | One-time password reset |
| GET/PATCH | `/users/me` | A | Own profile, preferences, contact privacy |
| GET/POST/PATCH | `/users/me/addresses` | A/O | Shipping addresses only; never public listing data |

### Existing pet care

| Method | Path | Access | Semantics |
| --- | --- | --- | --- |
| GET/POST | `/pets` | A | List/create own pets; vet list uses assigned-record path |
| GET/PATCH/DELETE | `/pets/{petId}` | O | Own pet data; delete policy may require archive instead |
| GET/POST | `/pets/{petId}/medical` | O or V | Authorized vaccine/medication/timeline records |
| GET/POST | `/pets/{petId}/documents` | O or V (scoped) | Authorized documents and upload references |
| GET/POST | `/pets/{petId}/tasks` | O | Care routines/tasks |
| POST | `/tasks/{taskId}/complete` | O | Complete one occurrence; safe on repeat |
| GET/POST/PATCH | `/reminders` | O | Reminder schedules/opt-in policy |
| GET | `/vets` | A or P (approved directory) | Public safe vet identities |
| GET | `/vets/{vetId}/slots` | A | Available appointment slots; final availability rechecked on booking |
| GET/POST | `/appointments` | A | Own or assigned appointments; booking needs pet owner |
| GET/PATCH | `/appointments/{id}` | O or V | View/cancel/reschedule/record within allowed transitions |
| GET/POST | `/pets/{petId}/expenses` | O | Own expense records |
| GET | `/reports/expenses` | O | Own summaries; currency filtering and no cross-user data |

### Adoption / pet donation

| Method | Path | Access | Semantics |
| --- | --- | --- | --- |
| GET | `/adoptions` | P | Approved published listings, redacted |
| POST | `/adoptions` | A | Owner creates draft; moderation required |
| GET | `/adoptions/{id}` | P or listing O/M | Public redacted view, or authorized owner/moderator private view |
| PATCH | `/adoptions/{id}` | Listing O, pre-final | Edit draft or withdraw; changes may trigger re-review |
| GET/POST | `/adoptions/{id}/applications` | Listing O/M for list, A for own submission | Apply; never expose competing applicants to each other |
| GET | `/my/adoption-applications` | A | Applicant's own applications |
| POST | `/adoptions/{id}/applications/{applicationId}/decision` | Listing O (approved) | Accept/reject with legal state restrictions |
| POST | `/adoptions/{id}/handover` | Prior owner/new owner | Each confirms; backend completes when checks pass |
| GET/POST | `/donation-campaigns` | P; verified beneficiary for create | **Optional phase**: verified monetary campaigns |
| POST | `/donation-contributions` | A/guest only if legally supported | **Optional phase**: provider-secured contribution; idempotent |
| GET | `/donations/{id}` | Donor/beneficiary/M | Optional contribution receipt/status, no other donor data |

Animal rehoming is distinct from monetary donations. No payment is assumed for a standard adoption listing.

### Pet sale marketplace

| Method | Path | Access | Semantics |
| --- | --- | --- | --- |
| GET | `/marketplace/pets` | P | Approved `ACTIVE` sale listings only |
| POST | `/marketplace/pets` | S | Draft listing with lawful/welfare evidence |
| GET | `/marketplace/pets/{id}` | P or listing O/M | Redacted public or authorized private listing |
| PATCH | `/marketplace/pets/{id}` | S and listing O | Edit/withdraw; significant changes reset approval |
| POST | `/marketplace/inquiries` | A | Ask seller; contact info redacted by default |
| GET | `/marketplace/inquiries` | Inquiry buyer or listing seller | Own conversations only; may be scoped via query |
| POST | `/marketplace/sales` | S + buyer confirmation | Finalize exactly one approved, lawful in-person handover |

Sales/payment support for live animals is jurisdiction-dependent and **not equivalent to food store checkout**. Do not expose an animal shipping quote or delivery route.

### Lost and found

| Method | Path | Access | Semantics |
| --- | --- | --- | --- |
| GET | `/lost-found` | P | Redacted `OPEN` reports with generalized area |
| POST | `/lost-found` | A | Post lost/found notice, server strips location metadata |
| GET/PATCH | `/lost-found/{id}` | P for redacted GET; O/M for update | Read or update own report |
| POST | `/lost-found/{id}/sightings` | A | Private report of sighting, approximate area |
| GET | `/lost-found/{id}/sightings` | O/M | Sensitive sightings; not publicly enumerable |
| POST | `/lost-found/{id}/claims` | A | Private ownership claim with restricted proof |
| POST | `/lost-found/{id}/reunion` | O/M and verified parties | Complete checked reunification transition |

### Pet food store

| Method | Path | Access | Semantics |
| --- | --- | --- | --- |
| GET | `/shop/categories` | P | Published food categories |
| GET | `/shop/products` | P | Published stock-aware products; paginated/filterable |
| GET | `/shop/products/{id}` | P | Safe product details; avoid sensitive operational fields |
| GET/POST/PATCH/DELETE | `/cart` | A | Own cart; server validates quantities and product status |
| POST | `/checkout` | A | Idempotent order placement + server pricing + inventory transaction |
| GET | `/orders` | A | Buyer's orders or scoped operator view |
| GET | `/orders/{id}` | Buyer or SO/M | Order with shipping/payment state according to access |
| POST | `/orders/{id}/cancel` | Buyer or SO | Policy-allowed cancellation |
| POST | `/orders/{id}/refund` | SO/M | Controlled refund request/workflow |
| POST | `/payments/webhook/{provider}` | Verified provider only | Signed verified provider event, replay-safe |
| GET/POST | `/shop/products/{id}/reviews` | Public approved reviews; verified buyer to submit | Only purchased-product review, moderation possible |

Checkout should reserve stock and create a `PLACED` order; transition to `PAID` only when the payment outcome is verified. If cash on delivery is supported later, define a separate authorized state path, not an invented successful payment.

### Utility, moderation and administration

| Method | Path | Access | Semantics |
| --- | --- | --- | --- |
| POST | `/media` | A | Upload request/safe metadata; virus scanning, private ACL |
| GET/PATCH | `/notifications` | A | Own notifications, mark read |
| GET/POST/DELETE | `/favorites` | A | Own saved listings/products |
| POST | `/reports/listings` | A | Report suspicious listing/reason, anti-spam |
| GET | `/admin/users` | M | Scoped user records; protected PII |
| GET/POST | `/admin/verifications` | M | Vet and seller verification approvals |
| GET/POST | `/admin/moderation` | M | Review/approve/reject/appeal decisions |
| GET/PATCH | `/admin/inventory` | SO or authorized M | Food stock operations with audit |
| GET/POST/PATCH | `/admin/catalog` | SO or M | Food categories/products |
| GET/PATCH | `/admin/orders` | SO or M | Fulfillment and returns; least privilege |
| GET | `/admin/reports` | Authorized M | Aggregated operational reporting |

## 3. Example DTOs (illustrative, to be finalized in OpenAPI)

### Create adoption draft

```http
POST /api/v1/adoptions
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "petId": "pet_123",
  "title": "Buddy needs a new home",
  "reason": "Owner cannot continue providing care",
  "generalArea": "Dhaka North",
  "careNotes": "Vaccination record available privately",
  "photoFileIds": ["file_101"]
}
```

Response `201`: `{"data":{"id":"ad_20","status":"DRAFT"},"requestId":"req_120"}`. Submission for review is a separate validated transition or explicit endpoint; a created draft is **not published**.

### Submit sighting

```json
{
  "observedAt": "2026-11-05T07:15:00Z",
  "approximateArea": "Mirpur, Dhaka",
  "description": "Seen near a public crossing",
  "photoFileIds": []
}
```

Do not send exact GPS coordinates to public consumers; sensitive details, if collected with valid purpose, remain access-controlled.

### Place food order

```http
POST /api/v1/checkout
Authorization: Bearer <access-token>
Idempotency-Key: 75e4c5e8-5c94-4e8c-bad2-77c45f30554b
Content-Type: application/json
```

```json
{
  "shippingAddressId": "addr_12",
  "paymentMethod": "PROVIDER_PENDING",
  "cartVersion": 6
}
```

Success response `201` (example; figures are illustrative):

```json
{
  "data": {
    "orderId": "ord_901",
    "status": "PLACED",
    "paymentStatus": "PENDING",
    "totals": {
      "itemsMinor": 150000,
      "shippingMinor": 10000,
      "taxMinor": 0,
      "totalMinor": 160000,
      "currency": "BDT"
    }
  },
  "requestId": "req_901"
}
```

Price and item quantities **must** be derived/rechecked by the backend from persisted catalogue and inventory, not submitted as trusted client totals.

## 4. Lifecycle / transition rules

| Entity | Valid normal path | Disallowed examples |
| --- | --- | --- |
| Adoption listing | `DRAFT → PENDING_REVIEW → PUBLISHED → MATCHED → COMPLETED` | Applicant marking `COMPLETED`; bypassing review |
| Adoption application | `SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED` | Applicant approving own application |
| Pet-sale listing | `DRAFT → PENDING_REVIEW → ACTIVE → RESERVED → SOLD` | Seller self-approving; two finalized sales |
| Lost post | `OPEN → VERIFYING → REUNITED` | Stranger marking post reunited |
| Vet appointment | `REQUESTED → CONFIRMED → IN_PROGRESS → COMPLETED` | Double-booked slot, unauthorized note entry |
| Food order | `PLACED → PAID → PACKED → SHIPPED → DELIVERED` | `PLACED → DELIVERED` without allowed fulfillment evidence |
| Refund | `REQUESTED → APPROVED → PROCESSED` (separate refund record if implemented) | Repeated webhook issuing multiple refunds |

Exceptional transitions (`CANCELLED`, `REJECTED`, `WITHDRAWN`, `REMOVED`, `REFUNDED`, `NO_SHOW`) require explicit authorization, reason and domain-specific policy.

## 5. Contract-level security guarantees

- Rate-limit registration, login, password reset, messages, sightings, uploads, payment/checkout and listing creation.
- Validate species, age/welfare proof and seller capability for sales; apply moderation to public listings and reports.
- Authorize **each entity**, not just route class. IDs passed in URLs are untrusted.
- Filter/mask fields in public DTOs; even admins should not receive unrelated sensitive data by default.
- Upload endpoints validate MIME **and** file signatures, size/type, strip EXIF, malware-scan, and serve via scoped signed access.
- Webhooks require verified signatures/secret rotation and processed-event uniqueness.
- Sensitive calls set `Cache-Control: no-store`; public content caching requires explicit moderation/version invalidation.
- Document owner transfer and financial actions with `AUDIT_EVENTS`.

## 6. OpenAPI and testing requirements

1. Annotate ASP.NET endpoints with schemas, descriptions, authorization, response status and examples.
2. Generate `/openapi/v1.json` as part of build/CI in a controlled environment.
3. Generate `packages/api-contracts/` TypeScript types/client; web/mobile import only generated definitions.
4. Validate generated spec stability; flag unexpected breaking changes and require versioning strategy.
5. Integration-test anonymous/owner/vet/admin/seller/store operator success and forbidden paths.
6. Test races: appointment conflict, simultaneous inventory checkout, adoption handover and payment callback replay.

**This document defines proposed contracts, not endpoint implementations.** See [data-dictionary.md](data-dictionary.md), [permissions-matrix.md](permissions-matrix.md), [trust-and-safety.md](trust-and-safety.md) and [acceptance-tests.md](acceptance-tests.md).
