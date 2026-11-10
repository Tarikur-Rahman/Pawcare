# PawCare approved decisions — integration baseline

This file supersedes older references to optional SQLite in archived blueprint documents.

- **Database:** Oracle only. Oracle schema `PAWCARE_APP` and migrations `V001`–`V012` are the single source of truth. Do not deploy or maintain SQLite schemas.
- **Backend:** ASP.NET Core 10; database secrets and JWT signing key remain server-only.
- **Web:** Next.js 16 with same-origin server relay and HttpOnly session cookies.
- **Mobile:** React Native with Expo; use the PC LAN address for physical phone testing, never `10.0.2.2`.
- **Development:** run automated checks before release; unexecuted Oracle migrations are not considered deployed.
- **Features intentionally gated:** real payment capture, monetary donations, live pet-sale transfers, public media publication and external notifications require independently verified integrations and applicable policy/welfare checks.
- **Source package status:** implementation files assembled and syntax/static-checked; no successful end-to-end or production certification is implied.
