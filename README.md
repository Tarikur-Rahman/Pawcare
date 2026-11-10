<div align="center">

# 🐾 PawCare

### Pet Care & Management Platform

**A full-stack pet care platform built with ASP.NET Core 10, Next.js 16, React Native (Expo), and Oracle Database.**

[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React_Native-Expo-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Oracle](https://img.shields.io/badge/Database-Oracle-F80000?logo=oracle&logoColor=white)](https://www.oracle.com/database/)

**[GitHub Repository](https://github.com/Tarikur-Rahman/Pawcare)**

</div>

---

## Overview

PawCare brings pet-related services and everyday management into a single platform. The project combines an **ASP.NET Core REST API**, a **Next.js web application**, a **React Native/Expo mobile client**, and an **Oracle-backed relational database**.

The codebase is organized around pet owners, veterinarians, and administrators. It includes modules for pet profiles, medical records, care tasks, appointments, adoption, lost-and-found reports, a pet marketplace, and a pet food store.

> **Project status:** Active development. The web password-recovery flow (V014) has been implemented and tested locally. Other modules and mobile workflows may require additional integration, configuration, or end-to-end verification before production use.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Backend | C#, ASP.NET Core 10, REST APIs |
| Web application | Next.js 16, React, TypeScript |
| Mobile application | React Native, Expo, TypeScript |
| Database | Oracle Database, SQL / PL/SQL |
| Authentication | JWT access tokens, refresh sessions, email verification, password recovery |
| Email | SMTP (configurable; Gmail SMTP supported for local development) |
| Containers | Docker |
| Testing | .NET tests, Vitest / TypeScript checks |

## Core Modules

- **Authentication & accounts:** Registration, login, email verification, authorization, and forgot/reset password.
- **Pet management:** Pet profiles and associated information.
- **Medical records:** Health history and veterinarian-facing workflows.
- **Care & appointments:** Care tasks, reminders, and veterinary appointment management.
- **Adoption:** Pet adoption listings, applications, and handover-related workflows.
- **Lost & found:** Lost-pet reports, sightings, and reunion-related workflows.
- **Marketplace:** Pet-related listings and inquiries.
- **Pet food store:** Product catalog, cart, orders, and inventory-related services.
- **Administration:** Moderation, account administration, reporting, and operational tools.

The presence of a module in the source tree does not necessarily mean every user journey is production-ready.

## Repository Structure

```text
PawCare/
├── backend/
│   └── PawCare.Api/           # ASP.NET Core API and application modules
├── frontend/                  # Next.js web application
├── mobile/                    # React Native / Expo mobile application
├── database/
│   └── oracle/                # Oracle migrations, seeds, queries, and checks
├── global.json                # .NET toolchain / test-runner settings
├── .gitignore
└── README.md
```

This is the streamlined source-code layout; generated build output, local secrets, temporary files, and historical audit artifacts are not required in the repository.

## Getting Started

### Prerequisites

Install the tools relevant to the components you want to run:

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) and npm (use the version required by the frontend and mobile projects)
- [Oracle Database](https://www.oracle.com/database/) and an appropriately provisioned application schema
- [Docker](https://www.docker.com/) (optional for containerized backend execution)
- Android development tooling / Expo tooling for mobile development

### 1. Clone the repository

```bash
git clone https://github.com/Tarikur-Rahman/Pawcare.git
cd Pawcare
```

### 2. Configure Oracle

PawCare uses **Oracle as its database**. Review `database/oracle/README.md` and the migration/deployment SQL before setting up an environment.

The migration sources are under `database/oracle/migrations/` and include versions **V001–V014**, with V014 covering password recovery. Run migration preflight and verification procedures as documented; do not blindly reapply migrations to an existing database.

Use a dedicated application account and keep database credentials outside source control.

### 3. Configure and run the API

Create your local backend environment configuration from the supplied example, if applicable:

```bash
cp backend/PawCare.Api/.env.example backend/PawCare.Api/.env
```

Provide environment-specific values, including:

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings__PawCare` | Oracle connection string |
| `Jwt__Issuer` / `Jwt__Audience` | JWT issuer and audience |
| `Jwt__SigningKey` | Private JWT signing secret |
| `Email__Smtp__Enabled` | Enable or disable SMTP |
| `Email__Smtp__Host` / `Email__Smtp__Port` | SMTP server settings |
| `Email__Smtp__Username` / `Email__Smtp__Password` | SMTP credentials |
| `Email__VerificationUrlBase` | Base URL for verification and recovery links |

**Do not commit `.env` files or actual credentials.** The `.env` file is an example configuration source; the .NET runtime needs the values supplied as environment variables or through your chosen local launch configuration.

Build the backend:

```bash
dotnet restore backend/PawCare.Api/PawCare.Api.csproj
dotnet build backend/PawCare.Api/PawCare.Api.csproj -c Release
```

Start the API using your configured environment. You can also build its Docker image from the repository root:

```bash
docker build -f backend/PawCare.Api/Dockerfile -t pawcare-api:local .
```

> When running the backend in Docker and Oracle on the host machine, configure the Oracle connection string with a host name reachable **from the container** (for example, `host.docker.internal` on Docker Desktop).

### 4. Run the web application

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Update `.env.local` with the API address and other values expected by the frontend configuration. Then open **http://localhost:3000**.

### 5. Run the mobile application

In a separate terminal:

```bash
cd mobile
npm ci
cp .env.example .env
npx expo start
```

For a physical phone, configure the API URL using your development computer's reachable LAN address rather than `localhost`. Confirm that the Expo SDK and the target device or development build are compatible.

## Password Recovery (V014)

The web authentication flow provides:

1. A **Forgot Password** form that responds without revealing whether an account exists.
2. Email delivery of a time-limited password-reset link for eligible accounts.
3. A **Reset Password** form that validates a single-use token.
4. Password update and refresh-session revocation on successful reset.

API endpoints:

```http
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

For local development, configure `Email__VerificationUrlBase` to point to the web application's address. In production, use HTTPS and appropriate secret management.

## Testing & Validation

Run the checks supported by the components in your checkout:

```bash
# Backend compilation
dotnet build backend/PawCare.Api/PawCare.Api.csproj -c Release

# Web checks
cd frontend
npm ci
npm test
npm run build

# Mobile checks
cd ../mobile
npm ci
npm run typecheck
npm test
```

Some integration tests require a separately prepared **Oracle test environment** and should not be run against production data. The streamlined source-only repository may not include all historical test projects and deployment audit reports.

## Security Notes

- Never commit Oracle passwords, JWT keys, SMTP credentials, access tokens, or reset links.
- Use HTTPS in production and restrict database access to authorized services.
- Follow least-privilege principles for user roles and service accounts.
- Treat migration and rollback SQL as operationally sensitive; verify target databases before execution.
- Do not interpret successful compilation or unit tests as proof of production readiness.

## Roadmap

PawCare is being developed incrementally. Remaining work may include production hardening, expanded end-to-end coverage, deployment automation, and further validation of the mobile and administrative workflows.

## Repository

**GitHub:** [Tarikur-Rahman/Pawcare](https://github.com/Tarikur-Rahman/Pawcare)

---

<div align="center">

**PawCare — Supporting better pet care through connected software.** 🐾

</div>
