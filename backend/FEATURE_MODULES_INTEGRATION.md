# PawCare backend feature modules — integration guide

## Scope

This package implements the source files requested under `backend/PawCare.Api/Modules/`. It is designed for the previously delivered PawCare .NET 10 bootstrap, common error and response types, Oracle database infrastructure, security utilities, storage and communication gateways, and **Oracle V001–V013** schema. SQLite is **not** supported.

This is a source delivery, **not a compiled or Oracle-executed release**. The assembled project must be restored, built, run, and tested in your development environment before accepting or deploying these modules. Earlier backend packages are dependencies, not included here.

## Additional internal source files

* `Modules/Shared/ModuleDb.cs` — Oracle-only bound SQL commands and transactions, plus shared validation/request helpers.
* `Modules/ModuleRegistration.cs` — one entry point for dependency-injection registration and all 22 endpoint groups.

## Installation

Extract this archive into the **PawCare repository root**. Merge `backend/PawCare.Api/Modules/` with the earlier project; do not overwrite unrelated files.

**Prerequisites**:

1. The previously delivered `PawCare.Api.csproj` and `Program.cs` plus Common, Configuration, Middleware, Security and Infrastructure files have been incorporated.
2. Oracle V001 through V013 have run successfully and the schema/data dictionary has been verified on a dedicated database.
3. A safe JWT signing key, Oracle connection and appropriate development CORS origins are configured. The API must not expose Oracle credentials to web or mobile clients.
4. Register `AddPawCareServices` and `AddPawCareSecurity` using their respective packages' instructions; remove the earlier duplicate inline `AddAuthorization` block rather than registering conflicting policies.
5. Register the earlier infrastructure interfaces, **once**: `IPawCareDbConnectionFactory`, `IPaymentGateway`, `IEmailGateway`, `IObjectStorage` (development quarantine only) and `TimeProvider`. PaymentGateway is intentionally unavailable until a vetted provider is integrated. The media endpoint returns unavailable when storage is not configured.

Add to `backend/PawCare.Api/Program.cs`:

```csharp
using PawCare.Api.Modules;
```

After the prerequisite infrastructure registrations and **before** `builder.Build()`:

```csharp
builder.Services.AddPawCareFeatureModules();
```

After setting up the required middleware (`UseAuthentication`, `UseAuthorization`) and **before** `app.Run()`:

```csharp
app.MapPawCareFeatureModules();
```

**Exception handling:** the earlier bootstrap's inline generic exception handling must be replaced by the provided `ErrorHandler` middleware (with request-ID middleware), otherwise domain errors may incorrectly appear as HTTP 500. Follow that middleware package's registration guidance and test the full pipeline. Do not register both error handlers.

Run from repository root:

```powershell
dotnet restore .\backend\PawCare.Api\PawCare.Api.csproj
dotnet build .\backend\PawCare.Api\PawCare.Api.csproj
# Then run under the appropriate Development configuration and test /api/health/ready.
```

## Module coverage

| Module | Main functionality | Important boundary |
|---|---|---|
| Auth | Register, login, refresh, logout and current user | New accounts remain `PENDING_VERIFICATION`; email verification must be wired before login can be activated for them |
| Users | Profile, permitted account details and addresses | Private fields restricted to the authenticated account |
| Pets | Pet profiles and ownership | Owner-scoped operations |
| Medical | Vaccination, medication and health timeline | Owner-scoped data |
| Care | Care tasks and acknowledgements | No invented completion of recurring tasks |
| Appointments | Vet listing and booking/cancellation | Vet-lock conflict checks; production concurrency tests still required |
| Expenses | Owner pet expenses | Integer currency minor units |
| Adoption | Listings, applications, owner decision and dual handover | No unilateral ownership transfer |
| Donations | Campaign drafts / review support | Monetary collection disabled pending legal and payment approvals |
| Marketplace | Listings, seller eligibility, moderation and inquiries | Live-animal purchase/transfer completion is deliberately disabled until welfare and legal review |
| LostFound | Posts, sightings, claims and two-sided reunion | Protected location/contact details |
| Catalog | Food products and public browsing | Admin/store-operator controls |
| Inventory | Stock adjustments with records | Stock remains server-authoritative |
| Cart | Authenticated shopping cart | Server-side product validation |
| Orders | Checkout, reservations, cancellation and order history | Only unpaid orders at checkout; do not treat placement as payment |
| Payments | Checkout gateway and signed event handling | Default gateway fails closed; refunds/disputes need a separate workflow |
| Fulfillment | Paid **food** order shipment operations | No pet shipment through food-order fulfillment |
| Media | Private quarantined uploads and metadata | Not publicly downloadable without malware-scan/approval pipeline |
| Notifications | User-scoped notifications | Device-token registration/consent and remote delivery need further work |
| Moderation | Reports, favorites, staff review | Admin and current account-state checks |
| Admin | Administrative user/capability management | Manual review is not equivalent to verified email ownership |
| Reports | Basic owner and store reporting | Real financial settlement accounting not implemented |

## Known integration boundaries — important

* **Do not deploy without testing**: live .NET 10 compilation, Oracle SQL execution, transactions, concurrency, role-policy wiring, endpoint authentication, and real client integration have **not** been verified in this delivery environment.
* The Oracle scripts include some SQL*Plus/SQLcl directives. Run migrations through approved DBA procedures; do not auto-execute migrations from an API request.
* Physical cash collection, donation processing, pet sale finalization, and provider refunds are **not enabled**. No fabricated successful payment paths are included.
* Password verification is implemented, but pending registrations need a proper email verification/activation workflow. Manual admin activation must follow secure documented checks.
* Short-lived JWTs do not guarantee immediate invalidation after account suspension; a live session/account-state check or token revocation strategy is needed for sensitive actions.
* User-provided uploads stay quarantined. Configure malware scanning, EXIF handling and controlled publishing before making media public.
* Role checks and query-level owner filtering must be tested with both same-user and cross-user requests.
* Operational outbox/worker support from earlier packages must be registered separately and enabled only after their Oracle schemas and transaction lifecycles have been tested.
* Functional testing should include simultaneous bookings, stock reservations, duplicate webhook deliveries, multi-user adoption handovers, lost-pet privacy, and moderation decisions.

## Verification checklist

1. `dotnet build` succeeds with all previous packages assembled.
2. `/api/health/ready` reports valid Oracle migration history.
3. Every `/api/v1/*` group is mapped exactly once; unauthenticated private endpoints return 401.
4. Requests for another owner's pet/profile/orders return no private records.
5. Concurrent bookings cannot double-book a veterinarian.
6. Concurrent checkout cannot oversell inventory, and repeat checkout keys do not produce duplicate orders.
7. Unverified webhook events cannot create a paid order; signed and duplicated events are handled safely.
8. Adoption requires both parties' authenticated confirmations, and lost/found claims do not expose private addresses.
9. Donation and live-animal purchase completion stay unavailable pending operator/provider approvals.
10. Production storage and notifications respect consent, security and retention policies.
