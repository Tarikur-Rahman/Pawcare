# PawCare feature modules

The feature modules belong in this directory, but their implementation files were **not included** in the current request (the requested outline refers to a following page). No feature endpoints or mock implementations are silently created here.

Planned modules include Identity, Pets, Care, Appointments, Adoption, Donations, Pet Marketplace, Moderation, Lost & Found, Food Catalog, Cart/Orders, Payments and Reporting, as documented in `docs/architecture.md`.

The unit tests in `PawCare.Api.Tests` explicitly **skip** business workflows whose modules do not exist yet. Replace their skipped cases with executable API/service tests when each module is implemented; do not count them as passing coverage.
