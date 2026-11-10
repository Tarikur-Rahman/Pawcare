# PawCare — Roles, Capabilities and Permissions Matrix

> **Status:** target server-enforced authorization policy; not implemented merely by documenting it.  
> **Principle:** **role + capability + object ownership/assignment + state** determine access. Hiding a UI action is not an authorization control.

## 1. Actors and capabilities

| Identity | Scope | Details |
| --- | --- | --- |
| `GUEST` | Unauthenticated public | Read approved, redacted discovery and publicly available food catalogue |
| `OWNER` | Primary role | Own pets and associated medical/care/expense records; create applications, posts, reports, and food orders |
| `VET` | Primary role | Assigned consultations and explicitly authorized pet medical data; not arbitrary pet accounts |
| `ADMIN` | Primary role | Moderation/user/approval operations subject to least privilege, reason and audit requirements |
| `APPROVED_SELLER` | Revocable capability | Extra ability for an OWNER to submit approved species/welfare-verified sale listings |
| `STORE_OPERATOR` | Revocable capability | Scoped catalogue, stock and order-fulfillment access; not a separate primary role |
| `MODERATOR` | Optional scoped admin capability | May moderate a specific domain where delegated, without broad access to payments/medical data |

A person can have one primary role and a set of active capabilities; retain a history of grants/revocations in `USER_CAPABILITIES` and `AUDIT_EVENTS`. Do not treat every admin as automatically needing access to every private pet health file or payment detail.

## 2. Permission codes

- **P** = public approved/redacted view only.
- **O** = owner (or original poster / authorized participant) scoped.
- **V** = assigned/consented veterinarian scoped.
- **A** = authenticated user acting on their own data/request.
- **S** = active approved seller, and owns the listing/pet.
- **M** = authorized moderator/admin within assigned review scope, audited.
- **SO** = scoped food-store operator.
- **—** = not permitted by default.

Permission checks are evaluated **per object** on all read/update/list actions; `?id=...` and path IDs are untrusted. For a guest request to unpublished/private content, return a non-enumerating `404` rather than exposing record existence.

## 3. Matrix: account, care and veterinary features

| Action | Guest | Owner | Vet | Admin | Special conditions |
| --- | --- | --- | --- | --- | --- |
| Register / login | Yes | Yes | Yes | Yes | Rate limits, safe responses, verification |
| View own account | — | A | A | A | Only own sensitive account fields |
| Update another account | — | — | — | M | Scope + legitimate purpose + audit |
| Create pet | — | A | — | — | Creates owned pet; cannot choose another owner arbitrarily |
| View own pet | — | O | V | M* | `M*` only for approved support/moderation purpose |
| Edit pet profile | — | O | — | M* | Ownership transfer uses separate controlled process |
| View pet health/documents | — | O | V | M* | Vet consent/assignment; no unscoped admin dump |
| Add vaccine/medication note | — | O with provenance | V | — | Distinguish owner-entered vs clinician-entered entries |
| Create/complete care task | — | O | — | — | Owner only unless delegated caretaker capability is added |
| Browse approved vet directory | P | P | P | P | Safe professional profile data |
| Book pet visit | — | O | — | — | Pet ownership and slot availability enforced |
| See appointment | — | O | V | M* | Only participants or authorized audit staff |
| Vet update visit notes | — | — | V | — | Must be assigned and state allows edit |
| Record pet expense | — | O | — | — | Never include in public profile |
| View system user metrics | — | — | — | M | Aggregated/minimized; audit sensitive detail access |

## 4. Matrix: adoption, sales and lost/found

| Action | Guest | Owner | Vet | Admin | Extra conditions |
| --- | --- | --- | --- | --- | --- |
| Browse approved adoption | P | P | P | P | Redacted public projection only |
| Create adoption draft | — | A | — | — | Owner/guardian or authorized rescue; welfare declarations |
| Publish own adoption post directly | — | — | — | M | Approval required; original poster cannot self-approve |
| Apply to adopt | — | A | A if permitted as ordinary user | — | One valid application per configured policy; screening |
| View adoption applications | — | O (listing poster or applicant sees only own) | — | M | No access to other applicants |
| Approve applicant | — | O (listing poster) | — | M* | Listing must be approved; admin intervention audited |
| Confirm adoption handover | — | O (prior owner or approved new owner) | — | M* | Both confirmations + backend transaction |
| Browse approved pet-sale listings | P | P | P | P | Legal species, approved, redacted only |
| Submit pet-sale listing | — | S | — | — | Active seller grant, own pet, evidence and policy checks |
| Approve/reject pet-sale listing | — | — | — | M | No seller self-approval; decision reason |
| Inquire about permitted listing | — | A | A if ordinary-user path permitted | — | Report/rate limits; no phone/email leaks |
| Reserve or confirm handover | — | S + participating buyer | — | M* | Legal in-person handover; one finalized sale |
| Browse lost/found posts | P | P | P | P | Approximate area only, no exact coordinates |
| Create lost/found post | — | A | A if ordinary-user path permitted | — | Requires credible relationship or authorized finder declaration |
| Submit private sighting | — | A | A | — | Never publicly publish reporter contact/proof |
| Read private sighting/claim proof | — | O (post owner / claimant sees own proof only) | — | M | Case-based entitlement, explicit reason and audit |
| Mark report reunited | — | O after verified handover | — | M | Claims must be verified; no random stranger closure |
| Report suspicious content | — | A | A | A | Rate limits and abuse triage |

**Optional monetary donations:** only verified campaign beneficiaries can publish; contributions/payments require explicit legal, provider and verification approval before activating any endpoints. The role matrix does **not** implicitly authorize direct monetary fundraising.

## 5. Matrix: food commerce and operations

| Action | Guest | Owner | Vet | Admin | Store operator | Conditions |
| --- | --- | --- | --- | --- | --- | --- |
| Browse published foods | P | P | P | P | P | Safe product fields only |
| Edit food products/prices | — | — | — | M or SO | SO | Audit price changes, role + scope |
| Edit inventory | — | — | — | M or SO | SO | Append movement + invariant checks |
| Create/view own cart | — | A | A if ordinary-user path | A own | A own | One cart per customer; no cross-user read |
| Place own food order | — | A | A if ordinary-user path | A own | A own | Valid address, authenticated, server price and idempotency |
| View order | — | O | O if own order | M* | SO scoped | Only buyer and authorized operator |
| Update shipment | — | — | — | M or SO | SO | Food only; audited transition |
| Initiate refund | — | O requests | O requests | M | SO per delegated policy | Provider confirmation, no duplicate refunds |
| View all payments | — | — | — | M* | — or limited | No raw card data; strict purpose & logging |
| Review bought food | — | O (verified purchase) | O (verified purchase) | — | — | Moderation for abuse |

## 6. API enforcement implementation pattern

1. **Authentication:** derive trusted identity from signed, valid access token/session, not the request body.
2. **Primary role:** verify route-level minimum role.
3. **Capability:** check active non-revoked grant where required (`APPROVED_SELLER`, `STORE_OPERATOR`).
4. **Object scope:** fetch entity through an ownership/assignment-filtered query or validate owner against caller; prevent cross-tenant enumeration.
5. **State guard:** check legal transition and concurrent version; verify eligibility and moderation outcome.
6. **Audit:** write append-only event for sensitive read/action when required; record request ID and reason.
7. **Public projection:** select only safe allowlisted columns, not `SELECT *` serialized wholesale.

Example pseudocode:

```csharp
// Conceptual authorization, not a finished implementation.
var caller = RequireAuthenticatedUser(context);
var listing = await repo.GetForUpdateAsync(listingId, cancellationToken);
RequireActiveCapability(caller, "APPROVED_SELLER");
RequireEqual(listing.SellerUserId, caller.UserId);
RequireState(listing.Status, "ACTIVE", "RESERVED");
RequireLawfulSpeciesAndWelfareApproval(listing);
// Continue in a transaction with required buyer/handover checks.
```

This checks a seller's authority; **buyers and handover confirmations also require independent checks**. Authorization must be enforced again at the query/transaction boundary.

## 7. Negative tests (required)

| Test ID | Attempt | Expected |
| --- | --- | --- |
| `AUTHZ-001` | Change pet ID to someone else's pet | `404`/`403` per non-disclosure policy; no data returned |
| `AUTHZ-002` | Vet reads unassigned appointment | Denied and logged if needed |
| `AUTHZ-003` | Owner calls `/admin/moderation` | Denied, never modifies status |
| `AUTHZ-004` | Unapproved owner posts market listing | Denied; cannot bypass by editing JSON role/capabilities |
| `AUTHZ-005` | Seller approves their own sale listing | Denied |
| `AUTHZ-006` | Unrelated user views adoption applicants | Denied; no personal data in error |
| `AUTHZ-007` | Public user retrieves precise lost pet coordinates | Never returned; public DTO has only generalized location |
| `AUTHZ-008` | Buyer reads another buyer's order | Denied |
| `AUTHZ-009` | Operator accesses owner medical data | Denied unless independently authorized |
| `AUTHZ-010` | Revoke seller capability during active session | New seller mutation denied without waiting for token expiry (server checks grants) |
| `AUTHZ-011` | Concurrent handover confirmations with stale listing state | Exactly one successful completion/ownership transfer |
| `AUTHZ-012` | Expired token invokes sensitive mutation | `401`, no write |

## 8. Ownership handover specifics

- Adoption: prior owner and approved adopter must confirm; record the transfer, close adoption listing, update `PETS.owner_user_id`, emit audit + notification atomically.
- Sale: verified seller and approved buyer confirm physical handover, check sale is valid in launch jurisdiction, then write a unique sale transaction and ownership change.
- If a listing refers to a pet **not yet** in `PETS`, creation/linking of the new pet record requires an explicit ownership-verification flow instead of silently assigning an ID.
- A user cannot approve a transaction or claim on the basis of a client-submitted `role`, `ownerId`, `isVerified` or `status`.

## 9. Administrative access boundaries

Administrative credentials must have MFA for production where supported, be individually attributable, and be prohibited from using shared accounts. Private-proof access should require a case link or legitimate support reason. All moderation decisions record action, timestamp, target, reason and actor; users need a clear appeal route. Sensitive records must respect retention policy and applicable privacy law.

These are **implementation requirements**. Refer to [api-contracts.md](api-contracts.md), [trust-and-safety.md](trust-and-safety.md), [data-dictionary.md](data-dictionary.md) and [acceptance-tests.md](acceptance-tests.md).
