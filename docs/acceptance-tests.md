# PawCare — Acceptance Test Plan and Release Gates

> **Status:** planned tests / expected results; **no test in this document has been executed**.  
> **Applies to:** ASP.NET Core 10, Next.js 16, Expo mobile, Oracle Database only.  
> **Traceability:** `architecture.md`, `api-contracts.md`, `data-dictionary.md`, `permissions-matrix.md`, `trust-and-safety.md`.

## 1. Test principles and evidence

A feature is **Done** only when its SQL migrations, backend business rules and permissions, API contract, web and mobile UX, moderation path (if relevant), and automated tests are delivered as a vertical slice. UI mockups are not evidence of a working backend. A server returning `200` for `/api/health` is not proof that auth or SQL transactions work.

For each test record:

| Field | Required detail |
| --- | --- |
| Test ID | Stable ID such as `PC-AUTH-001` |
| Build/commit | Git SHA, branch, pipeline run URL |
| Environment | Local/CI/staging, OS/phone model, Oracle PDB/schema |
| Seed | Reproducible synthetic fixtures; no real user personal data |
| Steps | Exact API/web/mobile actions and assertions |
| Expected | Observable result + DB invariant + security property |
| Actual | Captured outcome and sanitized evidence |
| Result | PASS, FAIL, BLOCKED, NOT RUN |
| Issue | Link to defect, severity, owner and retest result |

Do not treat tests blocked by missing Oracle or a real phone as passed. Run privacy/security checks across both adapters as appropriate, with critical transactional scenarios on Oracle before production.

## 2. Minimum acceptance environment

- **Backend:** .NET 10 API, versioned SQL migrations, health/readiness endpoint, test-safe authentication.
- **SQL:** dedicated disposable Oracle PDB/schema for migration, integrity, integration and concurrency tests.
- **Web:** Next.js production build and responsive E2E browser runner (desktop + phone viewport).
- **Mobile:** Expo preview for early development; **real physical Android phone** and signed/development build for native permission/push acceptance.
- **Test identities:** `ownerA`, `ownerB`, `vetAssigned`, `vetUnassigned`, `admin`, `approvedSeller`, `unapprovedSeller`, `storeOperator`, anonymous guest.
- **Fixtures:** 2 pets under different owners, vet schedule, submitted and approved adoption post, legitimate sale listing, lost report, 2 food products with finite stock, a private attachment, fake payment provider webhooks.

All fixture names, photos, contact data and documents must be synthetic or explicitly authorized.

## 3. Foundation, SQL and reliability

| ID | Test / steps | Expected result | Layer |
| --- | --- | --- | --- |
| `PC-INF-001` | Clone on clean Windows workstation; follow documented bootstrap | API + web + Expo can be started without hand-editing generated output | Manual |
| `PC-INF-002` | Start API, call `/api/health` | Stable safe health output; readiness reports DB failure separately | API |
| `PC-INF-003` | Open API from phone over same trusted LAN | Phone can reach API, login and an authorized pet endpoint | Real Android |
| `PC-INF-004` | Load `mobile/.env` with real phone IP, not emulator alias | No `10.0.2.2` default used on physical phone; no raw IP in user-facing error | Mobile |
| `PC-INF-005` | Disconnect database, exercise endpoint | Safe failure, request ID, no raw SQL/password, recovery after reconnect | API |
| `PC-DB-001` | Apply V001–V013 to blank Oracle schema | Correct ordered migration ledger; all applicable constraints exist | Oracle |
| `PC-DB-002` | Verify all Oracle foreign keys, indexes and seed categories after V013 | Expected objects and constraints match migrations | Oracle |
| `PC-DB-003` | Attempt duplicate email, SKU, cart item and sale finalization | Oracle unique constraints reject duplicates | Oracle |
| `PC-DB-004` | Run the booking and checkout concurrency scenarios against Oracle | No double-booking or overselling, all transactions consistent | Integration |
| `PC-DB-005` | Restore backup in isolated environment | Critical records and audit data recovered; recovery procedure recorded | Operations |
| `PC-OBS-001` | Trigger API error, follow `requestId` | Trace from client to scrubbed log without credentials/PII | Observability |

## 4. Identity, roles and original care features

| ID | Steps / scenario | Expected result | Layer |
| --- | --- | --- | --- |
| `PC-AUTH-001` | Register, verify if required, login, refresh, logout | Appropriate 201/200 responses; refresh rotated; revoked session no longer works | API + web + phone |
| `PC-AUTH-002` | Brute-force/rapid login attempts | Rate limited; account enumeration not exposed | API security |
| `PC-AUTH-003` | Expire/revoke JWT then mutate record | `401`, no write; client offers sign-in, does not loop | API + clients |
| `PC-AUTH-004` | Owner A changes URL/body pet ID to Owner B's | Denied (`403`/non-enumerating `404`), no leak | API |
| `PC-AUTH-005` | Vet requests an unassigned pet record | Denied; authorized assigned record works | API + vet UI |
| `PC-AUTH-006` | Unapproved owner changes seller capability client-side | No authority gain; server rejects | API security |
| `PC-CORE-001` | Create/edit/view own pet from web; inspect mobile | Same correct record on both clients; other owner cannot see | E2E |
| `PC-CORE-002` | Add vaccine, medication, document; view timeline | Correct ordered details and provenance; private document protected | API + UI |
| `PC-CORE-003` | Schedule repeating care task; complete occurrence | Single task completion, next occurrence scheduled once, correct time zone | Worker + API |
| `PC-CORE-004` | Two owners concurrently book same vet slot | Exactly one permitted reservation or non-overlapping booked intervals | Oracle concurrency |
| `PC-CORE-005` | Assigned vet adds consultation note, closes visit | Valid status transition, audit/author recorded; unrelated vet denied | API + vet UI |
| `PC-CORE-006` | Add expense, filter by pet/month, switch client | Correct currency/amount and consistent filters; no cross-user data | Web + phone |
| `PC-CORE-007` | Admin creates/verifies vet account | Scoped ability works; action audited; owner cannot do it | API + admin UI |

## 5. Adoption / rehoming

| ID | Steps / scenario | Expected result | Layer |
| --- | --- | --- | --- |
| `PC-ADOPT-001` | Owner creates draft with pet, welfare notes, media | `DRAFT`; not visible publicly; private media access controlled | API + UI |
| `PC-ADOPT-002` | Submit for review, moderator approves | `PENDING_REVIEW` then `PUBLISHED`; public listing redacted | API + web + mobile |
| `PC-ADOPT-003` | Applicant creates adoption application | Only their own application details visible to applicant | API |
| `PC-ADOPT-004` | Poster accepts applicant, only one party confirms handover | Listing not `COMPLETED`; pet ownership unchanged | API + SQL |
| `PC-ADOPT-005` | Both authorized parties confirm | One handover record; pet owner updated once; listing closed; audit exists | Oracle transaction |
| `PC-ADOPT-006` | Replay handover / race two confirmations | No duplicate transfer; stable idempotent result or `409` | Oracle concurrency |
| `PC-ADOPT-007` | Reject/withdraw listing, query as guest | Hidden from approved public discovery; meaningful private status | API + UI |
| `PC-ADOPT-008` | Fake owner attempts to transfer someone else's pet | Denied without ownership modification | Security |
| `PC-DONATE-001` | Inspect default product config | Monetary fundraising remains disabled until verification, payment and legal controls approved | Configuration |

## 6. Pet buy/sell marketplace

| ID | Steps / scenario | Expected result | Layer |
| --- | --- | --- | --- |
| `PC-MKT-001` | Unverified seller submits live-animal listing | Denied or restricted to private verification draft | API |
| `PC-MKT-002` | Approved seller submits permitted listing | Enters review; public cannot see until approved | API + UI |
| `PC-MKT-003` | Seller attempts self-approval | Denied; admin decision audited | Security |
| `PC-MKT-004` | Submit prohibited species, implausible age or missing required welfare evidence | Denied/held for review, never public | Trust + API |
| `PC-MKT-005` | Buyer inquires on approved listing | Buyer/seller see scoped messages; anonymous user sees no private contact | API + UI |
| `PC-MKT-006` | Two parallel buyers try to finalize same listing | At most one completed sale and one owner transfer | Oracle concurrency |
| `PC-MKT-007` | Inspect animal listing and complete flow | **No shipping/delivery option for live pets**; recorded safe handover | Web + phone |
| `PC-MKT-008` | Report seller; admin removes listing | Removed from discovery, actor/reason audited, appeal route available | Moderation |

## 7. Lost and found

| ID | Steps / scenario | Expected result | Layer |
| --- | --- | --- | --- |
| `PC-LOST-001` | Create lost report with photo containing GPS EXIF | Public media strips GPS; API reports generalized location | API + media |
| `PC-LOST-002` | Anonymous browse/map/detail request | No exact address, raw GPS, phone, email or proof URLs | API + web + phone |
| `PC-LOST-003` | Authenticated user submits private sighting | Only authorized poster/moderator access; reporter info redacted elsewhere | API |
| `PC-LOST-004` | Random user submits claim without valid proof | Cannot close post; proof held private, may be denied | API |
| `PC-LOST-005` | Verified reunion | Status `REUNITED`, audit and notifications; private proof not made public | E2E |
| `PC-LOST-006` | User reports malicious/suspicious lost post | Scoped moderation queue; reporter identity protected | Moderation |

## 8. Pet food store, payments and orders

| ID | Steps / scenario | Expected result | Layer |
| --- | --- | --- | --- |
| `PC-SHOP-001` | Guest views categories and published foods | Accurate unit/weight/price/availability; no unpublished products | Web + phone |
| `PC-SHOP-002` | Add/edit cart and login on another device | Own cart persists, valid quantity and no cross-user access | API + E2E |
| `PC-SHOP-003` | Two shoppers buy remaining one unit simultaneously | No negative available inventory; exactly one successful reservation/order | Oracle concurrency |
| `PC-SHOP-004` | Reuse same checkout idempotency key with same payload | Same order/result, no duplicate charge/order | API + SQL |
| `PC-SHOP-005` | Reuse same key with changed address/cart | `409` conflict; no duplicated order or charge | API |
| `PC-SHOP-006` | Forged or replayed webhook callback | Invalid signature rejected; replay idempotent and no duplicate payment | API security |
| `PC-SHOP-007` | Place order with pending payment | `PLACED`/`PENDING`, not falsely `PAID` | API + UI |
| `PC-SHOP-008` | Correct verified payment followed by packing/shipment | Legal transitions only, audit and user order timeline | E2E |
| `PC-SHOP-009` | Cancel/refund under published rules | Correct refund/status trail, no repeated refund | API + provider sandbox |
| `PC-SHOP-010` | Edit product price after order placement | Historical order item price remains immutable snapshot | SQL |
| `PC-SHOP-011` | Add pet-sale listing to food cart | Rejected; `SHIPMENTS` never refers to live animals | API + data integrity |
| `PC-SHOP-012` | Buyer submits review for unpurchased product | Denied; verified purchase required | API |

## 9. Trust, privacy and abuse prevention

| ID | Steps / scenario | Expected result |
| --- | --- | --- |
| `PC-SAFE-001` | Public fetch adoption application, seller proof, medical file, shipment address | Non-enumerating denial; no fields/media leaked |
| `PC-SAFE-002` | Upload invalid MIME, executable renamed as image, oversized file | Rejected and logged safely |
| `PC-SAFE-003` | Try SQL injection in search/filter/form fields | Parameterized queries; no SQL execution or secret exposure |
| `PC-SAFE-004` | Repeated sightings, reports, login and inquiries | Appropriate abuse/rate protections |
| `PC-SAFE-005` | Moderator review, rejection and appeal | Decision and reason auditable; appeal processed by permitted reviewer |
| `PC-SAFE-006` | Private-media URL shared to anonymous browser | Not accessible or expires according to short-lived policy |
| `PC-SAFE-007` | Unlisted pet with public URL guessed | `404` without title/contact leaks |
| `PC-SAFE-008` | Review logs/client errors for secret exposure | No JWT, passwords, API secrets, raw PII, raw GPS or card details |
| `PC-SAFE-009` | Revoke seller or store operator capability | New privileged mutation fails immediately via authoritative grant check |
| `PC-SAFE-010` | Unsupported jurisdiction/species sale attempted | Listing blocked per approved local allowlist/policy |

## 10. Accessibility and UX acceptance

| ID | Scenario | Expected result |
| --- | --- | --- |
| `PC-UX-001` | Keyboard-only login, listing create, checkout, admin review | Logical focus order and visible focus |
| `PC-UX-002` | Screen-reader on representative native screens | Meaningful accessible labels, statuses and error announcements |
| `PC-UX-003` | Increase phone font/text scaling | No inaccessible clipped primary action; forms remain usable |
| `PC-UX-004` | Small web viewport and 200–400% zoom | Content reflows without unexpected horizontal scrolling |
| `PC-UX-005` | Force slow network/timeout/offline | Loading/empty/retry and stale indicators; drafts preserved |
| `PC-UX-006` | User-facing API failure | Friendly message, optional support request ID; no LAN IP/stack trace |
| `PC-UX-007` | Compare adoption vs pet sale details | Distinct purpose, action and safety disclaimer; no misleading button label |
| `PC-UX-008` | Submit form with invalid required field | Specific inline validation and focus on first error |
| `PC-UX-009` | Apply reduced motion / contrast checks | Preferences respected; status not conveyed by color alone |
| `PC-UX-010` | Inspect permissions vs navigation | Hidden/disabled unauthorized controls, API authorization still decisive |

## 11. Performance and robustness plan

Capture a baseline with representative synthetic data; choose quantitative service-level targets **only after measurement**.

| ID | Workload | Measure / invariant |
| --- | --- | --- |
| `PC-PERF-001` | Owner dashboard with many pets/tasks | p50/p95 response time, number of SQL queries, cache correctness |
| `PC-PERF-002` | Search/paginate 10k+ approved listings | Latency, memory, stable pagination, PII-safe projection |
| `PC-PERF-003` | Browse 1000+ food products | Pagination, image lazy loading, network bytes, slow phone responsiveness |
| `PC-PERF-004` | Parallel appointment creation | No overlapping active booking beyond allowed concurrency rules |
| `PC-PERF-005` | Parallel food checkout + payment callbacks | No oversell, duplicate order, double-capture or lost outbox event |
| `PC-PERF-006` | Background reminder/outbox backlog | Retries with backoff and dedup; observable failed/poison events |
| `PC-PERF-007` | Device app cold start and low connectivity | Meaningful first content, error recovery, bounded memory |

## 12. CI and release gates

### CI gate — every pull request

- [ ] Applicable .NET restore/build/test, TypeScript type-check, Next.js build, Expo bundle checks run.
- [ ] Oracle migration and integrity verification pass on an isolated test schema; SQL checks and source formatting checked.
- [ ] Security dependency scan passes high/critical vulnerability policy; no committed secrets.
- [ ] API contract diff reviewed; generated TS contract updated.
- [ ] New feature has both authorized and unauthorized API tests; review covers animal/privacy rules.

### Staging gate — before external pilot

- [ ] Oracle migration from blank schema, schema integrity and relevant concurrency tests pass.
- [ ] Web E2E passes on desktop + phone viewport; physical Android E2E passes on real device.
- [ ] Adoption handover, pet sale moderation, private reunion and food checkout cover happy + adverse paths.
- [ ] Test payment provider webhook/replay/refund in sandbox; verify food inventory and immutable order pricing.
- [ ] Accessibility, security and media/location-redaction checks pass.
- [ ] Monitoring, backup restoration, feature flags and rollback procedure rehearsed.

### Production gate — mandatory

1. No known unresolved **critical/high exploitable vulnerabilities**, authorization bypass or animal-safety blockers.
2. Relevant legal, welfare, consumer, privacy, refund and moderation policies approved for launch jurisdictions.
3. SQL and payment operational controls tested (stock, idempotency, webhook signatures and reconciliation).
4. Guest/owner/vet/admin/seller/operator role and object access boundaries pass.
5. Real-device access and native build signing/notification permission checks pass; no raw local-development URL in release build.
6. Named release approver records evidence links, migration ID, commit SHA, sign-off and known limitations.

**Decision rule:** a single failing security, owner-transfer, privacy or payment-integrity test blocks release. Cosmetic defects may be triaged by severity but must remain in the known-issues register.

## 13. Defect classification and retest

- **Blocker:** unauthorized medical/proof exposure, illegal live-animal listing enabled, ownership transfer without consent, negative inventory/double charge, invalid webhook accepted, production secret leak.
- **High:** care/appointments unavailable to a major user group, inaccessible core checkout flow, widespread unhandled errors.
- **Medium:** incorrect filtering, recoverable UI problem, poor but not blocking layout/accessibility flaw.
- **Low:** cosmetic inconsistency with no meaningful functional impact.

For every defect include reproduction, logs scrubbed of secrets, sample request ID, SQL verification (if needed), before/after screenshots, fix commit and retest evidence. Re-run a proportionate regression set after any authorization/schema/state-machine change.

## 14. Definition of Done by module

| Required artifact | Evidence |
| --- | --- |
| SQL migration + constraints | Applied to isolated Oracle test schema, checked indexes and FK integrity |
| Backend service + repository + API | Tests for normal, edge and forbidden cases; OpenAPI updated |
| Web | Loading/empty/error/accessible responsive paths |
| Mobile | Real device path, offline/keyboard/photo flow where applicable |
| Permissions | Matrix and anti-IDOR tests updated |
| Trust/abuse | Moderation/reports/appeals if public listing involved |
| Operations | Logs/metrics/health/retry behavior documented |
| Documentation | API/data/UX/deployment and test plan updated together |

**All test cases in this file are specifications awaiting implementation and execution.** See [deployment.md](deployment.md), [trust-and-safety.md](trust-and-safety.md), [architecture.md](architecture.md), [api-contracts.md](api-contracts.md) and [permissions-matrix.md](permissions-matrix.md).
