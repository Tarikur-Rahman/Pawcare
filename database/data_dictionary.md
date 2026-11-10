# PawCare Oracle Database — Data Dictionary

> **Source of truth:** the existing Oracle `V001_core_care.sql` through `V012_outbox_keys_indexes.sql` files, reviewed on 2026-11-05. This document is generated from those SQL definitions; if it disagrees with a deployed database, investigate the drift rather than silently editing applied migrations. **Oracle only**; no SQLite runtime is part of the approved design.

## 1. Conventions and interpretation

- Owner schema: `PAWCARE_APP` (created by `000_create_schema.sql` in the chosen Oracle PDB). Oracle `USER` owns schema objects.
- SQL object names are uppercase; ordinary columns are shown exactly as declared. `NUMBER(19,0)` identity IDs are exposed to JavaScript clients as **strings**, avoiding 53-bit integer precision loss.
- `TIMESTAMP(6) WITH TIME ZONE` stores an offset; the API normalizes exchanged timestamps to UTC. Local display relies on user preferences.
- Currency amounts use integer minor units (`*_minor`) and three-letter currency codes; the database does not perform automatic conversion.
- `PK` denotes a primary-key column, `FK → TABLE.COLUMN` denotes a foreign-key column, `UQ` denotes membership of a declared unique constraint. A composite key is represented by its individual marked columns.
- A column is **Required** only when explicitly `NOT NULL` appears in its column declaration; primary-key membership also implies non-null at runtime. See checks and keys for additional restrictions.
- Some security and workflow rules (owner-only access, legal approval of pet sales, appointment overlaps, payment verification) must be enforced by the API and are not inferred from a foreign key.
- `SCHEMA_MIGRATIONS` is an internal ledger; table counts below include it. Oracle DDL auto-commits and versioned migration scripts must not be edited once deployed.

## 2. Migration and object inventory

| Migration | Purpose | Tables introduced | Explicit indexes | Triggers | Views |
|---|---|---:|---:|---:|---:|
| `V001` | Core pet care + migration ledger | 8 | 15 | 7 | 0 |
| `V002` | Identity profiles, capabilities, sessions, addresses | 4 | 6 | 2 | 0 |
| `V003` | Assets, notifications, device tokens, audit trail | 4 | 6 | 0 | 0 |
| `V004` | Adoption listing/application/handover | 4 | 12 | 1 | 0 |
| `V005` | Optional donation campaigns/contributions | 2 | 6 | 1 | 0 |
| `V006` | Pet sales, inquiries, transaction record | 4 | 12 | 2 | 0 |
| `V007` | Moderation, content reports, favorites | 3 | 8 | 0 | 0 |
| `V008` | Lost/found notices and reunification workflow | 4 | 14 | 1 | 0 |
| `V009` | Food catalog and inventory | 5 | 5 | 3 | 0 |
| `V010` | Carts, orders and stock reservations | 5 | 7 | 3 | 0 |
| `V011` | Payments, shipments and reviews | 4 | 9 | 3 | 0 |
| `V012` | Outbox, idempotency, listing locks and public views | 3 | 9 | 0 | 4 |

**Total:** 50 tables (49 application tables + 1 migration ledger), 109 explicitly declared indexes, 23 triggers, and 4 public projection views. PK/UQ indexes created automatically by Oracle are **not** included in the explicit-index total.

## 3. Detailed table dictionary

### V001 — Core pet care + migration ledger

#### `SCHEMA_MIGRATIONS`

Migration version ledger with SHA-256 source checksums.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `MIGRATION_VERSION` | `VARCHAR2(32 BYTE)` | No | PK | — |
| `DESCRIPTION` | `VARCHAR2(160 BYTE)` | No | — | — |
| `PROVIDER` | `VARCHAR2(16 BYTE)` | No | — | `'ORACLE'` |
| `CHECKSUM_SHA256` | `CHAR(64 BYTE)` | No | — | — |
| `APPLIED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_MIGRATION_PROVIDER`: `provider = 'ORACLE'`
- `CK_MIGRATION_SHA256`: `REGEXP_LIKE(checksum_sha256, '^[0-9a-f]{64}$')`

#### `USERS`

Authentication identities, primary roles, and account state.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `USER_ID` | `NUMBER(19,0)` | No | PK | identity |
| `EMAIL` | `VARCHAR2(254 BYTE)` | No | UQ | — |
| `PASSWORD_HASH` | `VARCHAR2(255 BYTE)` | No | — | — |
| `ROLE` | `VARCHAR2(8 BYTE)` | No | — | `'OWNER'` |
| `STATUS` | `VARCHAR2(24 BYTE)` | No | — | `'PENDING_VERIFICATION'` |
| `EMAIL_VERIFIED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_USERS_EMAIL` (`EMAIL`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_USERS_EMAIL_CANON`: `email = LOWER(TRIM(email)) AND INSTR(email, '@') > 1 AND INSTR(email, ' ') = 0`
- `CK_USERS_ROLE`: `role IN ('OWNER', 'VET', 'ADMIN')`
- `CK_USERS_STATUS`: `status IN ( 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED' )`

#### `PETS`

Current pet profile and owner relationship.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `PET_ID` | `NUMBER(19,0)` | No | PK | identity |
| `OWNER_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `NAME` | `VARCHAR2(120 BYTE)` | No | — | — |
| `SPECIES` | `VARCHAR2(80 BYTE)` | No | — | — |
| `BREED` | `VARCHAR2(120 BYTE)` | Yes | — | — |
| `DATE_OF_BIRTH` | `DATE` | Yes | — | — |
| `SEX` | `VARCHAR2(12 BYTE)` | No | — | `'UNKNOWN'` |
| `ATTRIBUTES_JSON` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'ACTIVE'` |
| `ARCHIVED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_PETS_SEX`: `sex IN ('MALE', 'FEMALE', 'UNKNOWN')`
- `CK_PETS_STATUS`: `status IN ('ACTIVE', 'ARCHIVED', 'DECEASED')`
- `CK_PETS_ARCHIVE`: `(status = 'ARCHIVED' AND archived_at IS NOT NULL) OR (status <> 'ARCHIVED' AND archived_at IS NULL)`
- `CK_PETS_ATTRIBUTES_JSON`: `attributes_json IS JSON (STRICT)`

#### `VACCINATIONS`

Administered vaccines and follow-up due dates.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `VACCINATION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `VACCINE_NAME` | `VARCHAR2(160 BYTE)` | No | — | — |
| `ADMINISTERED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `NEXT_DUE_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `VETERINARIAN_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `RECORDED_BY_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `NOTES` | `VARCHAR2(2000 BYTE)` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_VACC_DUE_AFTER_ADMIN`: `next_due_at IS NULL OR next_due_at >= administered_at`

#### `MEDICATIONS`

Pet medication plans and entered dosing instructions.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `MEDICATION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `MEDICATION_NAME` | `VARCHAR2(160 BYTE)` | No | — | — |
| `DOSAGE_TEXT` | `VARCHAR2(300 BYTE)` | No | — | — |
| `INSTRUCTIONS` | `VARCHAR2(2000 BYTE)` | Yes | — | — |
| `START_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `END_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `SCHEDULE_RULE` | `VARCHAR2(512 BYTE)` | Yes | — | — |
| `STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'ACTIVE'` |
| `CREATED_BY_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_MED_DATES`: `end_at IS NULL OR end_at >= start_at`
- `CK_MED_STATUS`: `status IN ('ACTIVE', 'COMPLETED', 'STOPPED')`

#### `CARE_TASKS`

Single scheduled pet-care occurrences and completion state.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CARE_TASK_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `TASK_TYPE` | `VARCHAR2(20 BYTE)` | No | — | — |
| `TITLE` | `VARCHAR2(160 BYTE)` | No | — | — |
| `DUE_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `RECURRENCE_RULE` | `VARCHAR2(512 BYTE)` | Yes | — | — |
| `OCCURRENCE_KEY` | `VARCHAR2(160 BYTE)` | Yes | UQ | — |
| `STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'PENDING'` |
| `COMPLETED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `TIME_ZONE` | `VARCHAR2(64 BYTE)` | No | — | `'UTC'` |
| `CREATED_BY_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_CARE_OCCURRENCE_KEY` (`OCCURRENCE_KEY`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_CARE_TYPE`: `task_type IN ( 'FEEDING', 'GROOMING', 'MEDICATION', 'EXERCISE', 'HYGIENE', 'OTHER' )`
- `CK_CARE_STATUS`: `status IN ('PENDING', 'COMPLETED', 'CANCELLED')`
- `CK_CARE_COMPLETION`: `(status = 'COMPLETED' AND completed_at IS NOT NULL) OR (status <> 'COMPLETED' AND completed_at IS NULL)`

#### `APPOINTMENTS`

Veterinary appointment time windows, status, and notes.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `APPOINTMENT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `VET_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `CREATED_BY_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `STARTS_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `ENDS_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'REQUESTED'` |
| `REASON` | `VARCHAR2(1000 BYTE)` | Yes | — | — |
| `VISIT_NOTES` | `CLOB` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_APPT_INTERVAL`: `ends_at > starts_at`
- `CK_APPT_STATUS`: `status IN ( 'REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW' )`

#### `EXPENSES`

Pet-specific spending records using currency minor units.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `EXPENSE_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `AMOUNT_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | `'BDT'` |
| `CATEGORY` | `VARCHAR2(20 BYTE)` | No | — | — |
| `OCCURRED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `DESCRIPTION` | `VARCHAR2(2000 BYTE)` | Yes | — | — |
| `CREATED_BY_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_EXP_AMOUNT`: `amount_minor >= 0`
- `CK_EXP_CURRENCY`: `REGEXP_LIKE(currency, '^[A-Z]{3}$')`
- `CK_EXP_CATEGORY`: `category IN ( 'FOOD', 'VET', 'MEDICATION', 'GROOMING', 'TOYS', 'SUPPLIES', 'OTHER' )`

### V002 — Identity profiles, capabilities, sessions, addresses

#### `USER_PROFILES`

Optional owner/vet/admin profile details and preferences.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `USER_ID` | `NUMBER(19,0)` | No | PK; FK → `USERS.USER_ID` | — |
| `DISPLAY_NAME` | `VARCHAR2(120 BYTE)` | No | — | — |
| `PHONE_E164` | `VARCHAR2(20 BYTE)` | Yes | — | — |
| `PREFERRED_TIME_ZONE` | `VARCHAR2(64 BYTE)` | No | — | `'Asia/Dhaka'` |
| `PREFERRED_LOCALE` | `VARCHAR2(16 BYTE)` | No | — | `'en'` |
| `NOTIFICATION_PREFERENCES_JSON` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `AVATAR_FILE_ID` | `NUMBER(19,0)` | Yes | FK → `FILE_ASSETS.FILE_ID` | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_PROFILE_PREF_JSON`: `notification_preferences_json IS JSON (STRICT)`
- `CK_PROFILE_PHONE`: `phone_e164 IS NULL OR REGEXP_LIKE(phone_e164, '^\+[1-9][0-9]{6,14}$')`

#### `USER_CAPABILITIES`

Time-bounded, approved account capabilities.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CAPABILITY_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `CAPABILITY` | `VARCHAR2(32 BYTE)` | No | — | — |
| `STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'ACTIVE'` |
| `GRANTED_BY_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `GRANTED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `EXPIRES_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `REVOKED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `REASON_CODE` | `VARCHAR2(80 BYTE)` | Yes | — | — |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_CAP_VALUE`: `capability IN ( 'APPROVED_SELLER','STORE_OPERATOR','VERIFIED_BENEFICIARY')`
- `CK_CAP_STATUS`: `status IN ('ACTIVE','REVOKED','EXPIRED')`
- `CK_CAP_REVOKED`: `(status = 'REVOKED' AND revoked_at IS NOT NULL) OR (status <> 'REVOKED' AND revoked_at IS NULL)`
- `CK_CAP_EXPIRY`: `expires_at IS NULL OR expires_at > granted_at`

#### `SESSIONS`

Hashed refresh-token/session lifecycle.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `SESSION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `REFRESH_TOKEN_HASH` | `CHAR(64 BYTE)` | No | UQ | — |
| `DEVICE_LABEL` | `VARCHAR2(140 BYTE)` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `EXPIRES_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `ROTATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `REVOKED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Unique constraints:** `UQ_SESSION_TOKEN_HASH` (`REFRESH_TOKEN_HASH`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_SESSION_HASH`: `REGEXP_LIKE(refresh_token_hash,'^[0-9a-f]{64}$')`
- `CK_SESSION_EXP`: `expires_at > created_at`

#### `ADDRESSES`

Private user contact and delivery addresses.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `ADDRESS_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `RECIPIENT_NAME` | `VARCHAR2(160 BYTE)` | No | — | — |
| `PHONE_E164` | `VARCHAR2(20 BYTE)` | Yes | — | — |
| `LINE_1` | `VARCHAR2(200 BYTE)` | No | — | — |
| `LINE_2` | `VARCHAR2(200 BYTE)` | Yes | — | — |
| `CITY` | `VARCHAR2(100 BYTE)` | No | — | — |
| `REGION` | `VARCHAR2(120 BYTE)` | Yes | — | — |
| `POSTAL_CODE` | `VARCHAR2(24 BYTE)` | Yes | — | — |
| `COUNTRY_CODE` | `CHAR(2 BYTE)` | No | — | `'BD'` |
| `SCOPE` | `VARCHAR2(12 BYTE)` | No | — | `'SHIPPING'` |
| `IS_DEFAULT` | `NUMBER(1)` | No | — | `0` |
| `STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'ACTIVE'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_ADDR_COUNTRY`: `REGEXP_LIKE(country_code,'^[A-Z]{2}$')`
- `CK_ADDR_SCOPE`: `scope IN ('SHIPPING','BILLING')`
- `CK_ADDR_DEFAULT`: `is_default IN (0,1)`
- `CK_ADDR_STATUS`: `status IN ('ACTIVE','ARCHIVED')`
- `CK_ADDR_PHONE`: `phone_e164 IS NULL OR REGEXP_LIKE(phone_e164,'^\+[1-9][0-9]{6,14}$')`

### V003 — Assets, notifications, device tokens, audit trail

#### `FILE_ASSETS`

Private media object metadata, scan state, and access policy.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `FILE_ID` | `NUMBER(19,0)` | No | PK | identity |
| `OWNER_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `OBJECT_KEY` | `VARCHAR2(512 BYTE)` | No | UQ | — |
| `MIME_TYPE` | `VARCHAR2(120 BYTE)` | No | — | — |
| `SIZE_BYTES` | `NUMBER(18,0)` | No | — | — |
| `SHA256_HEX` | `CHAR(64 BYTE)` | No | — | — |
| `ACCESS_POLICY` | `VARCHAR2(20 BYTE)` | No | — | `'PRIVATE'` |
| `SCAN_STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'PENDING'` |
| `EXIF_STRIPPED` | `NUMBER(1)` | No | — | `0` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `DELETED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Unique constraints:** `UQ_FILE_OBJECT_KEY` (`OBJECT_KEY`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_FILE_SIZE`: `size_bytes > 0`
- `CK_FILE_SHA`: `REGEXP_LIKE(sha256_hex,'^[0-9a-f]{64}$')`
- `CK_FILE_POLICY`: `access_policy IN ('PRIVATE','REVIEWER_ONLY','PUBLIC_APPROVED')`
- `CK_FILE_SCAN`: `scan_status IN ('PENDING','SAFE','BLOCKED')`
- `CK_FILE_EXIF`: `exif_stripped IN (0,1)`
- `CK_FILE_PUBLIC`: `access_policy <> 'PUBLIC_APPROVED' OR (scan_status = 'SAFE' AND exif_stripped=1 AND deleted_at IS NULL)`

#### `NOTIFICATIONS`

Persisted user notifications and read tracking.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `NOTIFICATION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `KIND` | `VARCHAR2(40 BYTE)` | No | — | — |
| `TITLE` | `VARCHAR2(160 BYTE)` | No | — | — |
| `BODY_TEXT` | `VARCHAR2(500 BYTE)` | Yes | — | — |
| `PAYLOAD_JSON` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `READ_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_NOTIF_JSON`: `payload_json IS JSON (STRICT)`

#### `DEVICE_TOKENS`

Device notification token metadata and encrypted token storage.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `TOKEN_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `PLATFORM` | `VARCHAR2(12 BYTE)` | No | — | — |
| `TOKEN_HASH` | `CHAR(64 BYTE)` | No | UQ | — |
| `TOKEN_CIPHERTEXT` | `VARCHAR2(4000 BYTE)` | No | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `LAST_SEEN_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `REVOKED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Unique constraints:** `UQ_DEVICE_HASH` (`TOKEN_HASH`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_DEVICE_PLATFORM`: `platform IN ('ANDROID','IOS','WEB')`
- `CK_DEVICE_SHA`: `REGEXP_LIKE(token_hash,'^[0-9a-f]{64}$')`

#### `AUDIT_EVENTS`

Security and moderation action audit trail.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `AUDIT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ACTOR_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `ACTION` | `VARCHAR2(100 BYTE)` | No | — | — |
| `ENTITY_TYPE` | `VARCHAR2(50 BYTE)` | No | — | — |
| `ENTITY_ID` | `VARCHAR2(80 BYTE)` | No | — | — |
| `REASON_CODE` | `VARCHAR2(80 BYTE)` | Yes | — | — |
| `REQUEST_ID` | `VARCHAR2(120 BYTE)` | Yes | — | — |
| `DETAILS_JSON` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `HAPPENED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_AUDIT_JSON`: `details_json IS JSON (STRICT)`

### V004 — Adoption listing/application/handover

#### `ADOPTION_LISTINGS`

Reviewed pet rehoming listings.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `ADOPTION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | Yes | FK → `PETS.PET_ID` | — |
| `CREATOR_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `TITLE` | `VARCHAR2(180 BYTE)` | No | — | — |
| `DESCRIPTION` | `VARCHAR2(4000 BYTE)` | No | — | — |
| `SPECIES` | `VARCHAR2(80 BYTE)` | No | — | — |
| `GENERAL_AREA` | `VARCHAR2(160 BYTE)` | No | — | — |
| `STATUS` | `VARCHAR2(20 BYTE)` | No | — | `'DRAFT'` |
| `REVIEWED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `REVIEWED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `POSTED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_ADOPT_STATUS`: `status IN ( 'DRAFT','PENDING_REVIEW','PUBLISHED','MATCHED','COMPLETED','REJECTED','WITHDRAWN')`
- `CK_ADOPT_PUBLISHED`: `status <> 'PUBLISHED' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND posted_at IS NOT NULL)`

#### `ADOPTION_MEDIA`

Media references attached to adoption listings.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `ADOPTION_MEDIA_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ADOPTION_ID` | `NUMBER(19,0)` | No | FK → `ADOPTION_LISTINGS.ADOPTION_ID`; UQ | — |
| `FILE_ID` | `NUMBER(19,0)` | No | FK → `FILE_ASSETS.FILE_ID`; UQ | — |
| `SORT_ORDER` | `NUMBER(5,0)` | No | UQ | `0` |

**Unique constraints:** `UQ_ADOPT_MEDIA_FILE` (`ADOPTION_ID, FILE_ID`); `UQ_ADOPT_MEDIA_SORT` (`ADOPTION_ID, SORT_ORDER`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_ADOPT_MEDIA_SORT`: `sort_order >= 0`

#### `ADOPTION_APPLICATIONS`

Private adoption applications and review outcome.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `APPLICATION_ID` | `NUMBER(19,0)` | No | PK; UQ | identity |
| `ADOPTION_ID` | `NUMBER(19,0)` | No | FK → `ADOPTION_LISTINGS.ADOPTION_ID`; UQ | — |
| `APPLICANT_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID`; UQ | — |
| `ANSWERS_PRIVATE` | `CLOB` | Yes | — | — |
| `STATUS` | `VARCHAR2(18 BYTE)` | No | — | `'SUBMITTED'` |
| `SUBMITTED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `REVIEWED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `REVIEWED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Unique constraints:** `UQ_ADOPT_APP_TRIPLET` (`ADOPTION_ID, APPLICATION_ID, APPLICANT_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_ADOPT_APP_STATUS`: `status IN ('SUBMITTED','IN_REVIEW','ACCEPTED','REJECTED','WITHDRAWN')`

#### `ADOPTION_HANDOVERS`

Dual-confirmed pet adoption handover records.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `HANDOVER_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ADOPTION_ID` | `NUMBER(19,0)` | No | FK → `ADOPTION_APPLICATIONS.ADOPTION_ID`; UQ | — |
| `APPLICATION_ID` | `NUMBER(19,0)` | No | FK → `ADOPTION_APPLICATIONS.APPLICATION_ID`; UQ | — |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `PRIOR_OWNER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `NEW_OWNER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `OWNER_CONFIRMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `ADOPTER_CONFIRMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CONFIRMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Unique constraints:** `UQ_HANDOVER_LISTING` (`ADOPTION_ID`); `UQ_HANDOVER_APP` (`APPLICATION_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_HANDOVER_DIFFERENT`: `prior_owner_id <> new_owner_id`
- `CK_HANDOVER_CONFIRM`: `confirmed_at IS NULL OR (owner_confirmed_at IS NOT NULL AND adopter_confirmed_at IS NOT NULL)`

### V005 — Optional donation campaigns/contributions

#### `DONATION_CAMPAIGNS`

Optional verified pet-welfare fundraising campaigns.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CAMPAIGN_ID` | `NUMBER(19,0)` | No | PK | identity |
| `BENEFICIARY_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `PURPOSE` | `VARCHAR2(2000 BYTE)` | No | — | — |
| `TITLE` | `VARCHAR2(200 BYTE)` | No | — | — |
| `GOAL_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | `'BDT'` |
| `VERIFICATION_STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'PENDING'` |
| `STATUS` | `VARCHAR2(20 BYTE)` | No | — | `'DRAFT'` |
| `REVIEWED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `REVIEWED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_DONATION_GOAL`: `goal_minor > 0`
- `CK_DONATION_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`
- `CK_DONATION_VERIFY`: `verification_status IN ('PENDING','VERIFIED','REJECTED')`
- `CK_DONATION_STATUS`: `status IN ('DRAFT','PENDING_REVIEW','PUBLISHED','PAUSED','CLOSED','REJECTED')`
- `CK_DONATION_PUBLISH`: `status <> 'PUBLISHED' OR (verification_status = 'VERIFIED' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)`

#### `DONATION_CONTRIBUTIONS`

Optional donor contribution and payment state records.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CONTRIBUTION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `CAMPAIGN_ID` | `NUMBER(19,0)` | No | FK → `DONATION_CAMPAIGNS.CAMPAIGN_ID` | — |
| `DONOR_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `AMOUNT_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | — |
| `PAYMENT_STATE` | `VARCHAR2(12 BYTE)` | No | — | `'PENDING'` |
| `PROVIDER_CODE` | `VARCHAR2(40 BYTE)` | Yes | — | — |
| `PROVIDER_REF` | `VARCHAR2(160 BYTE)` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `SETTLED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_CONTRIB_AMOUNT`: `amount_minor > 0`
- `CK_CONTRIB_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`
- `CK_CONTRIB_STATE`: `payment_state IN ('PENDING','SUCCEEDED','FAILED','REFUNDED')`
- `CK_CONTRIB_SETTLED`: `payment_state <> 'SUCCEEDED' OR settled_at IS NOT NULL`
- `CK_CONTRIB_PROVIDER`: `provider_ref IS NULL OR provider_code IS NOT NULL`

### V006 — Pet sales, inquiries, transaction record

#### `PET_SALE_LISTINGS`

Moderated pet sale listings where legally permissible.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `SALE_LISTING_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `SELLER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `TITLE` | `VARCHAR2(180 BYTE)` | No | — | — |
| `DESCRIPTION` | `VARCHAR2(4000 BYTE)` | No | — | — |
| `SPECIES` | `VARCHAR2(80 BYTE)` | No | — | — |
| `GENERAL_AREA` | `VARCHAR2(160 BYTE)` | No | — | — |
| `ASKING_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | `'BDT'` |
| `WELFARE_EVIDENCE_FILE_ID` | `NUMBER(19,0)` | Yes | FK → `FILE_ASSETS.FILE_ID` | — |
| `STATUS` | `VARCHAR2(20 BYTE)` | No | — | `'DRAFT'` |
| `REVIEWED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `REVIEWED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `POSTED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_SALE_AMOUNT`: `asking_minor >= 0`
- `CK_SALE_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`
- `CK_SALE_STATUS`: `status IN ( 'DRAFT','PENDING_REVIEW','ACTIVE','RESERVED','SOLD','REJECTED','REMOVED')`
- `CK_SALE_PUBLISHED`: `status <> 'ACTIVE' OR (welfare_evidence_file_id IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND posted_at IS NOT NULL)`

#### `PET_SALE_MEDIA`

Media attached to pet sale listings.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `SALE_MEDIA_ID` | `NUMBER(19,0)` | No | PK | identity |
| `SALE_LISTING_ID` | `NUMBER(19,0)` | No | FK → `PET_SALE_LISTINGS.SALE_LISTING_ID`; UQ | — |
| `FILE_ID` | `NUMBER(19,0)` | No | FK → `FILE_ASSETS.FILE_ID`; UQ | — |
| `SORT_ORDER` | `NUMBER(5,0)` | No | UQ | `0` |

**Unique constraints:** `UQ_SALE_MEDIA_FILE` (`SALE_LISTING_ID, FILE_ID`); `UQ_SALE_MEDIA_SORT` (`SALE_LISTING_ID, SORT_ORDER`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_SALE_MEDIA_SORT`: `sort_order >= 0`

#### `PET_SALE_INQUIRIES`

Private purchase inquiries and statuses.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `INQUIRY_ID` | `NUMBER(19,0)` | No | PK | identity |
| `SALE_LISTING_ID` | `NUMBER(19,0)` | No | FK → `PET_SALE_LISTINGS.SALE_LISTING_ID` | — |
| `BUYER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `MESSAGE_PRIVATE` | `VARCHAR2(4000 BYTE)` | No | — | — |
| `STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'OPEN'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_SALE_INQ_STATUS`: `status IN ('OPEN','RESPONDED','CLOSED','BLOCKED')`

#### `PET_SALE_TRANSACTIONS`

Controlled animal sale handover record; not a store shipment.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `SALE_TXN_ID` | `NUMBER(19,0)` | No | PK | identity |
| `SALE_LISTING_ID` | `NUMBER(19,0)` | No | FK → `PET_SALE_LISTINGS.SALE_LISTING_ID`; UQ | — |
| `PET_ID` | `NUMBER(19,0)` | No | FK → `PETS.PET_ID` | — |
| `SELLER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `BUYER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `AGREED_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | — |
| `HANDOVER_STATE` | `VARCHAR2(20 BYTE)` | No | — | `'PENDING'` |
| `SELLER_CONFIRMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `BUYER_CONFIRMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `COMPLETED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_SALE_TXN_LISTING` (`SALE_LISTING_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_SALE_TXN_DIFFERENT`: `seller_id <> buyer_id`
- `CK_SALE_TXN_AMOUNT`: `agreed_minor >= 0`
- `CK_SALE_TXN_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`
- `CK_SALE_TXN_STATE`: `handover_state IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED','DISPUTED')`
- `CK_SALE_TXN_COMPLETE`: `(handover_state = 'COMPLETED' AND completed_at IS NOT NULL AND seller_confirmed_at IS NOT NULL AND buyer_confirmed_at IS NOT NULL) OR (handover_state <> 'COMPLETED' AND completed_at IS NULL)`

### V007 — Moderation, content reports, favorites

#### `LISTING_REPORTS`

User reports about listings or activity.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `REPORT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `REPORTER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `LISTING_TYPE` | `VARCHAR2(20 BYTE)` | No | — | — |
| `LISTING_ID` | `NUMBER(19,0)` | No | — | — |
| `REASON_CODE` | `VARCHAR2(40 BYTE)` | No | — | — |
| `DETAILS_PRIVATE` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `REVIEW_STATE` | `VARCHAR2(16 BYTE)` | No | — | `'OPEN'` |
| `ASSIGNED_REVIEWER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `RESOLVED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_REPORT_TYPE`: `listing_type IN ('ADOPTION','PET_SALE','LOST_FOUND','FOOD_PRODUCT','DONATION')`
- `CK_REPORT_REASON`: `reason_code IN ('FRAUD','ABUSE','ILLEGAL','PRIVACY','SPAM','MISLEADING','OTHER')`
- `CK_REPORT_STATE`: `review_state IN ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')`
- `CK_REPORT_RESOLVED`: `(review_state IN ('RESOLVED','DISMISSED') AND resolved_at IS NOT NULL) OR (review_state IN ('OPEN','IN_REVIEW') AND resolved_at IS NULL)`

#### `MODERATION_ACTIONS`

Recorded moderation decisions and reasons.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `MODERATION_ACTION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ACTOR_USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `REPORT_ID` | `NUMBER(19,0)` | Yes | FK → `LISTING_REPORTS.REPORT_ID` | — |
| `ENTITY_TYPE` | `VARCHAR2(20 BYTE)` | No | — | — |
| `ENTITY_ID` | `NUMBER(19,0)` | No | — | — |
| `ACTION_CODE` | `VARCHAR2(24 BYTE)` | No | — | — |
| `REASON_CODE` | `VARCHAR2(80 BYTE)` | No | — | — |
| `PRIVATE_NOTE` | `VARCHAR2(2000 BYTE)` | Yes | — | — |
| `HAPPENED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_MOD_ENTITY`: `entity_type IN ('ADOPTION','PET_SALE','LOST_FOUND','FOOD_PRODUCT','DONATION','USER')`
- `CK_MOD_ACTION`: `action_code IN ('APPROVE','REJECT','HOLD','REMOVE','REINSTATE','APPEAL_UPHELD','APPEAL_DENIED')`

#### `FAVORITES`

Saved target entities for users.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `FAVORITE_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID`; UQ | — |
| `ENTITY_TYPE` | `VARCHAR2(20 BYTE)` | No | UQ | — |
| `ENTITY_ID` | `NUMBER(19,0)` | No | UQ | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_FAV_TARGET` (`USER_ID, ENTITY_TYPE, ENTITY_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_FAV_TYPE`: `entity_type IN ('ADOPTION','PET_SALE','LOST_FOUND','FOOD_PRODUCT')`

### V008 — Lost/found notices and reunification workflow

#### `LOST_FOUND_POSTS`

Lost/found pet notices with intentionally approximate public locations.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `POST_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PET_ID` | `NUMBER(19,0)` | Yes | FK → `PETS.PET_ID` | — |
| `POSTER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `CATEGORY` | `VARCHAR2(5 BYTE)` | No | — | — |
| `SPECIES` | `VARCHAR2(80 BYTE)` | No | — | — |
| `DESCRIPTION` | `VARCHAR2(4000 BYTE)` | No | — | — |
| `GENERAL_AREA` | `VARCHAR2(160 BYTE)` | No | — | — |
| `APPROXIMATE_RADIUS_KM` | `NUMBER(7,2)` | Yes | — | — |
| `OBSERVED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'DRAFT'` |
| `REVIEWED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `PUBLISHED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_LOST_CATEGORY`: `category IN ('LOST','FOUND')`
- `CK_LOST_STATUS`: `status IN ('DRAFT','OPEN','VERIFYING','REUNITED','CLOSED','REMOVED')`
- `CK_LOST_RADIUS`: `approximate_radius_km IS NULL OR approximate_radius_km > 0`
- `CK_LOST_PUBLIC`: `status <> 'OPEN' OR (reviewed_by_user_id IS NOT NULL AND published_at IS NOT NULL)`

#### `LOST_FOUND_MEDIA`

Media references for lost/found posts.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `LOST_MEDIA_ID` | `NUMBER(19,0)` | No | PK | identity |
| `POST_ID` | `NUMBER(19,0)` | No | FK → `LOST_FOUND_POSTS.POST_ID`; UQ | — |
| `FILE_ID` | `NUMBER(19,0)` | No | FK → `FILE_ASSETS.FILE_ID`; UQ | — |
| `SORT_ORDER` | `NUMBER(5,0)` | No | UQ | `0` |

**Unique constraints:** `UQ_LOST_MEDIA_FILE` (`POST_ID, FILE_ID`); `UQ_LOST_MEDIA_SORT` (`POST_ID, SORT_ORDER`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_LOST_MEDIA_SORT`: `sort_order >= 0`

#### `SIGHTINGS`

Private tips and approximate sightings for found/lost pets.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `SIGHTING_ID` | `NUMBER(19,0)` | No | PK | identity |
| `POST_ID` | `NUMBER(19,0)` | No | FK → `LOST_FOUND_POSTS.POST_ID` | — |
| `REPORTER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `APPROXIMATE_AREA` | `VARCHAR2(160 BYTE)` | No | — | — |
| `OBSERVED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `DESCRIPTION_PRIVATE` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `EVIDENCE_FILE_ID` | `NUMBER(19,0)` | Yes | FK → `FILE_ASSETS.FILE_ID` | — |
| `STATUS` | `VARCHAR2(14 BYTE)` | No | — | `'SUBMITTED'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_SIGHT_STATUS`: `status IN ('SUBMITTED','REVIEWED','DISMISSED')`

#### `REUNIFICATION_CLAIMS`

Identity evidence and dual confirmation of reunions.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CLAIM_ID` | `NUMBER(19,0)` | No | PK | identity |
| `POST_ID` | `NUMBER(19,0)` | No | FK → `LOST_FOUND_POSTS.POST_ID` | — |
| `CLAIMANT_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `PROOF_ASSET_ID` | `NUMBER(19,0)` | No | FK → `FILE_ASSETS.FILE_ID` | — |
| `STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'SUBMITTED'` |
| `REVIEWED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `REVIEWED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `POSTER_CONFIRMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CLAIMANT_CONFIRMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `RESOLVED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_REUNION_STATUS`: `status IN ('SUBMITTED','VERIFYING','VERIFIED','REUNITED','REJECTED','WITHDRAWN')`
- `CK_REUNION_RESOLVED`: `(status='REUNITED' AND resolved_at IS NOT NULL AND poster_confirmed_at IS NOT NULL AND claimant_confirmed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL) OR (status <> 'REUNITED' AND resolved_at IS NULL)`

### V009 — Food catalog and inventory

#### `FOOD_CATEGORIES`

Parent-child food category taxonomy.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CATEGORY_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PARENT_ID` | `NUMBER(19,0)` | Yes | FK → `FOOD_CATEGORIES.CATEGORY_ID` | — |
| `NAME` | `VARCHAR2(120 BYTE)` | No | — | — |
| `SLUG` | `VARCHAR2(120 BYTE)` | No | UQ | — |
| `STATUS` | `VARCHAR2(12 BYTE)` | No | — | `'DRAFT'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_FOOD_CAT_SLUG` (`SLUG`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_FOOD_CAT_STATUS`: `status IN ('DRAFT','ACTIVE','ARCHIVED')`
- `CK_FOOD_CAT_SLUG`: `REGEXP_LIKE(slug,'^[a-z0-9]+(-[a-z0-9]+)*$')`
- `CK_FOOD_CAT_SELF`: `parent_id IS NULL OR parent_id <> category_id`

#### `FOOD_PRODUCTS`

Food catalog with SKU, nutrition/allergen text, price and currency.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `PRODUCT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `CATEGORY_ID` | `NUMBER(19,0)` | No | FK → `FOOD_CATEGORIES.CATEGORY_ID` | — |
| `SKU` | `VARCHAR2(80 BYTE)` | No | UQ | — |
| `BRAND` | `VARCHAR2(160 BYTE)` | Yes | — | — |
| `TITLE` | `VARCHAR2(240 BYTE)` | No | — | — |
| `DESCRIPTION` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `TARGET_SPECIES` | `VARCHAR2(80 BYTE)` | No | — | — |
| `INGREDIENTS_TEXT` | `VARCHAR2(4000 BYTE)` | Yes | — | — |
| `ALLERGEN_TEXT` | `VARCHAR2(2000 BYTE)` | Yes | — | — |
| `NET_WEIGHT_GRAMS` | `NUMBER(10,0)` | Yes | — | — |
| `PRICE_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | `'BDT'` |
| `STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'DRAFT'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_FOOD_PROD_SKU` (`SKU`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_FOOD_PROD_PRICE`: `price_minor >= 0`
- `CK_FOOD_PROD_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`
- `CK_FOOD_PROD_WEIGHT`: `net_weight_grams IS NULL OR net_weight_grams > 0`
- `CK_FOOD_PROD_STATUS`: `status IN ('DRAFT','ACTIVE','PAUSED','RECALLED','ARCHIVED')`

#### `PRODUCT_IMAGES`

Media attached to food products.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `PRODUCT_IMAGE_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PRODUCT_ID` | `NUMBER(19,0)` | No | FK → `FOOD_PRODUCTS.PRODUCT_ID`; UQ | — |
| `FILE_ID` | `NUMBER(19,0)` | No | FK → `FILE_ASSETS.FILE_ID`; UQ | — |
| `SORT_ORDER` | `NUMBER(5,0)` | No | UQ | `0` |

**Unique constraints:** `UQ_PROD_IMG_FILE` (`PRODUCT_ID, FILE_ID`); `UQ_PROD_IMG_SORT` (`PRODUCT_ID, SORT_ORDER`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_PROD_IMG_SORT`: `sort_order >= 0`

#### `INVENTORY_STOCK`

On-hand and reserved stock quantities for each product.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `PRODUCT_ID` | `NUMBER(19,0)` | No | PK; FK → `FOOD_PRODUCTS.PRODUCT_ID` | — |
| `ON_HAND_QTY` | `NUMBER(12,0)` | No | — | `0` |
| `RESERVED_QTY` | `NUMBER(12,0)` | No | — | `0` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_STOCK_NONNEG`: `on_hand_qty >= 0 AND reserved_qty >= 0`
- `CK_STOCK_AVAILABLE`: `reserved_qty <= on_hand_qty`

#### `INVENTORY_MOVEMENTS`

Auditable inventory quantity changes.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `MOVEMENT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PRODUCT_ID` | `NUMBER(19,0)` | No | FK → `FOOD_PRODUCTS.PRODUCT_ID` | — |
| `QUANTITY_DELTA` | `NUMBER(12,0)` | No | — | — |
| `REASON` | `VARCHAR2(20 BYTE)` | No | — | — |
| `REFERENCE_TYPE` | `VARCHAR2(30 BYTE)` | Yes | — | — |
| `REFERENCE_ID` | `VARCHAR2(80 BYTE)` | Yes | — | — |
| `MOVEMENT_KEY` | `VARCHAR2(160 BYTE)` | No | UQ | — |
| `CREATED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_MOVE_KEY` (`MOVEMENT_KEY`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_MOVE_DELTA`: `quantity_delta <> 0`
- `CK_MOVE_REASON`: `reason IN ('RESTOCK','ADJUSTMENT','FULFILLMENT','RETURN','WRITE_OFF')`

### V010 — Carts, orders and stock reservations

#### `CARTS`

User shopping cart and version.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CART_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID`; UQ | — |
| `CART_VERSION` | `NUMBER(12,0)` | No | — | `1` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_CART_USER` (`USER_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_CART_VERSION`: `cart_version > 0`

#### `CART_ITEMS`

Product quantities in a cart.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `CART_ITEM_ID` | `NUMBER(19,0)` | No | PK | identity |
| `CART_ID` | `NUMBER(19,0)` | No | FK → `CARTS.CART_ID`; UQ | — |
| `PRODUCT_ID` | `NUMBER(19,0)` | No | FK → `FOOD_PRODUCTS.PRODUCT_ID`; UQ | — |
| `QUANTITY` | `NUMBER(9,0)` | No | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_CART_PRODUCT` (`CART_ID, PRODUCT_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_CART_ITEM_QTY`: `quantity BETWEEN 1 AND 999`

#### `ORDERS`

Food-store order header, immutable address snapshot and totals.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `ORDER_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ORDER_NUMBER` | `VARCHAR2(48 BYTE)` | No | UQ | — |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `SHIPPING_ADDRESS_ID` | `NUMBER(19,0)` | Yes | FK → `ADDRESSES.ADDRESS_ID` | — |
| `SHIPPING_ADDRESS_SNAPSHOT` | `VARCHAR2(4000 BYTE)` | No | — | — |
| `SUBTOTAL_MINOR` | `NUMBER(18,0)` | No | — | — |
| `SHIPPING_MINOR` | `NUMBER(18,0)` | No | — | `0` |
| `TAX_MINOR` | `NUMBER(18,0)` | No | — | `0` |
| `DISCOUNT_MINOR` | `NUMBER(18,0)` | No | — | `0` |
| `TOTAL_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | — |
| `STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'PLACED'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_ORDER_NUMBER` (`ORDER_NUMBER`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_ORDER_ADDRESS_JSON`: `shipping_address_snapshot IS JSON (STRICT)`
- `CK_ORDER_AMOUNTS`: `subtotal_minor >= 0 AND shipping_minor >= 0 AND tax_minor >= 0 AND discount_minor >= 0 AND total_minor >= 0`
- `CK_ORDER_TOTAL`: `total_minor=subtotal_minor+shipping_minor+tax_minor-discount_minor`
- `CK_ORDER_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`
- `CK_ORDER_STATUS`: `status IN ('PLACED','PAID','PACKED','SHIPPED','DELIVERED','CANCELLED','REFUNDED')`

#### `ORDER_ITEMS`

Food order line items with SKU/title/price snapshots.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `ORDER_ITEM_ID` | `NUMBER(19,0)` | No | PK; UQ | identity |
| `ORDER_ID` | `NUMBER(19,0)` | No | FK → `ORDERS.ORDER_ID`; UQ | — |
| `PRODUCT_ID` | `NUMBER(19,0)` | No | FK → `FOOD_PRODUCTS.PRODUCT_ID`; UQ | — |
| `SKU_SNAPSHOT` | `VARCHAR2(80 BYTE)` | No | — | — |
| `TITLE_SNAPSHOT` | `VARCHAR2(240 BYTE)` | No | — | — |
| `QUANTITY` | `NUMBER(9,0)` | No | — | — |
| `UNIT_PRICE_MINOR` | `NUMBER(18,0)` | No | — | — |
| `LINE_TOTAL_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | — |

**Unique constraints:** `UQ_ORDER_PRODUCT` (`ORDER_ID, PRODUCT_ID`); `UQ_ORDER_ITEM_PROD` (`ORDER_ITEM_ID, PRODUCT_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_ORDER_ITEM_QTY`: `quantity BETWEEN 1 AND 999`
- `CK_ORDER_ITEM_PRICE`: `unit_price_minor >= 0 AND line_total_minor >= 0`
- `CK_ORDER_ITEM_TOTAL`: `line_total_minor=unit_price_minor*quantity`
- `CK_ORDER_ITEM_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`

#### `ORDER_STOCK_RESERVATIONS`

Food stock reservations with expiration and lifecycle.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `RESERVATION_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ORDER_ID` | `NUMBER(19,0)` | No | FK → `ORDER_ITEMS.ORDER_ID`; UQ | — |
| `PRODUCT_ID` | `NUMBER(19,0)` | No | FK → `ORDER_ITEMS.PRODUCT_ID`; UQ | — |
| `QUANTITY` | `NUMBER(9,0)` | No | — | — |
| `STATE` | `VARCHAR2(12 BYTE)` | No | — | `'RESERVED'` |
| `RESERVED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `EXPIRES_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |
| `CLOSED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Unique constraints:** `UQ_RESERV_ORDER_PRODUCT` (`ORDER_ID, PRODUCT_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_RESERV_QTY`: `quantity BETWEEN 1 AND 999`
- `CK_RESERV_STATE`: `state IN ('RESERVED','CONSUMED','RELEASED','EXPIRED')`
- `CK_RESERV_EXP`: `expires_at > reserved_at`
- `CK_RESERV_CLOSED`: `(state='RESERVED' AND closed_at IS NULL) OR (state<>'RESERVED' AND closed_at IS NOT NULL)`

### V011 — Payments, shipments and reviews

#### `PAYMENTS`

Payment intent/state linked to exactly one supported transaction type.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `PAYMENT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ORDER_ID` | `NUMBER(19,0)` | Yes | FK → `ORDERS.ORDER_ID` | — |
| `SALE_TXN_ID` | `NUMBER(19,0)` | Yes | FK → `PET_SALE_TRANSACTIONS.SALE_TXN_ID` | — |
| `CONTRIBUTION_ID` | `NUMBER(19,0)` | Yes | FK → `DONATION_CONTRIBUTIONS.CONTRIBUTION_ID` | — |
| `PROVIDER_CODE` | `VARCHAR2(40 BYTE)` | No | UQ | — |
| `PROVIDER_REF` | `VARCHAR2(160 BYTE)` | Yes | UQ | — |
| `AMOUNT_MINOR` | `NUMBER(18,0)` | No | — | — |
| `CURRENCY` | `CHAR(3 BYTE)` | No | — | — |
| `STATE` | `VARCHAR2(16 BYTE)` | No | — | `'PENDING'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_PAY_PROVIDER_REF` (`PROVIDER_CODE, PROVIDER_REF`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_PAY_ONE_TARGET`: `(CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN sale_txn_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN contribution_id IS NOT NULL THEN 1 ELSE 0 END) = 1`
- `CK_PAY_AMOUNT`: `amount_minor > 0`
- `CK_PAY_CURRENCY`: `REGEXP_LIKE(currency,'^[A-Z]{3}$')`
- `CK_PAY_STATE`: `state IN ('PENDING','AUTHORIZED','CAPTURED','FAILED','REFUNDED','CANCELLED')`

#### `PAYMENT_EVENTS`

Deduplicated externally verified payment provider events.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `PAYMENT_EVENT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PAYMENT_ID` | `NUMBER(19,0)` | Yes | FK → `PAYMENTS.PAYMENT_ID` | — |
| `PROVIDER_CODE` | `VARCHAR2(40 BYTE)` | No | UQ | — |
| `PROVIDER_EVENT_ID` | `VARCHAR2(180 BYTE)` | No | UQ | — |
| `EVENT_TYPE` | `VARCHAR2(80 BYTE)` | No | — | — |
| `EVENT_PAYLOAD_SHA256` | `CHAR(64 BYTE)` | No | — | — |
| `OUTCOME` | `VARCHAR2(16 BYTE)` | No | — | — |
| `RECEIVED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `PROCESSED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |

**Unique constraints:** `UQ_PAYMENT_EVENT` (`PROVIDER_CODE, PROVIDER_EVENT_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_PAY_EVENT_HASH`: `REGEXP_LIKE(event_payload_sha256,'^[0-9a-f]{64}$')`
- `CK_PAY_EVENT_OUTCOME`: `outcome IN ('PROCESSED','IGNORED','REJECTED','PENDING')`

#### `SHIPMENTS`

Food-order delivery lifecycle and tracking.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `SHIPMENT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `ORDER_ID` | `NUMBER(19,0)` | No | FK → `ORDERS.ORDER_ID` | — |
| `CARRIER` | `VARCHAR2(100 BYTE)` | No | — | — |
| `TRACKING_REF` | `VARCHAR2(160 BYTE)` | Yes | — | — |
| `STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'PREPARING'` |
| `SHIPPED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `DELIVERED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_SHIPMENT_STATUS`: `status IN ('PREPARING','SHIPPED','DELIVERED','RETURNED','CANCELLED')`
- `CK_SHIPMENT_DATES`: `delivered_at IS NULL OR (shipped_at IS NOT NULL AND delivered_at >= shipped_at)`
- `CK_SHIPMENT_COMPLETE`: `status <> 'DELIVERED' OR delivered_at IS NOT NULL`

#### `PRODUCT_REVIEWS`

Moderated product reviews linked to a purchased order item.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `REVIEW_ID` | `NUMBER(19,0)` | No | PK | identity |
| `PRODUCT_ID` | `NUMBER(19,0)` | No | FK → `ORDER_ITEMS.PRODUCT_ID` | — |
| `BUYER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID` | — |
| `ORDER_ITEM_ID` | `NUMBER(19,0)` | No | FK → `ORDER_ITEMS.ORDER_ITEM_ID`; UQ | — |
| `RATING` | `NUMBER(1,0)` | No | — | — |
| `REVIEW_TEXT` | `VARCHAR2(3000 BYTE)` | Yes | — | — |
| `STATUS` | `VARCHAR2(16 BYTE)` | No | — | `'PENDING_REVIEW'` |
| `MODERATED_BY_USER_ID` | `NUMBER(19,0)` | Yes | FK → `USERS.USER_ID` | — |
| `MODERATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `UPDATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_REVIEW_ORDER_ITEM` (`ORDER_ITEM_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_REVIEW_RATING`: `rating BETWEEN 1 AND 5`
- `CK_REVIEW_STATUS`: `status IN ('PENDING_REVIEW','PUBLISHED','REJECTED','REMOVED')`
- `CK_REVIEW_PUBLISH`: `status <> 'PUBLISHED' OR (moderated_by_user_id IS NOT NULL AND moderated_at IS NOT NULL)`

### V012 — Outbox, idempotency, listing locks and public views

#### `OUTBOX_EVENTS`

Reliable asynchronous event delivery with deduplication.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `EVENT_ID` | `NUMBER(19,0)` | No | PK | identity |
| `EVENT_KIND` | `VARCHAR2(100 BYTE)` | No | — | — |
| `AGGREGATE_TYPE` | `VARCHAR2(60 BYTE)` | No | — | — |
| `AGGREGATE_ID` | `VARCHAR2(80 BYTE)` | No | — | — |
| `PAYLOAD_JSON` | `CLOB` | No | — | — |
| `DEDUPE_KEY` | `VARCHAR2(180 BYTE)` | No | UQ | — |
| `STATUS` | `VARCHAR2(14 BYTE)` | No | — | `'PENDING'` |
| `RETRY_COUNT` | `NUMBER(8,0)` | No | — | `0` |
| `NEXT_ATTEMPT_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `PROCESSED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | Yes | — | — |
| `LAST_ERROR_CODE` | `VARCHAR2(80 BYTE)` | Yes | — | — |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_OUTBOX_DEDUPE` (`DEDUPE_KEY`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_OUTBOX_JSON`: `payload_json IS JSON (STRICT)`
- `CK_OUTBOX_STATUS`: `status IN ('PENDING','PROCESSING','SENT','DEAD')`
- `CK_OUTBOX_RETRY`: `retry_count >= 0`
- `CK_OUTBOX_COMPLETE`: `status <> 'SENT' OR processed_at IS NOT NULL`

#### `IDEMPOTENCY_KEYS`

Per-user request replay prevention for sensitive operations.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `KEY_ID` | `NUMBER(19,0)` | No | PK | identity |
| `USER_ID` | `NUMBER(19,0)` | No | FK → `USERS.USER_ID`; UQ | — |
| `OPERATION` | `VARCHAR2(80 BYTE)` | No | UQ | — |
| `KEY_VALUE` | `VARCHAR2(160 BYTE)` | No | UQ | — |
| `REQUEST_HASH` | `CHAR(64 BYTE)` | No | — | — |
| `RESPONSE_REF` | `VARCHAR2(160 BYTE)` | Yes | — | — |
| `STATE` | `VARCHAR2(16 BYTE)` | No | — | `'IN_PROGRESS'` |
| `CREATED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |
| `EXPIRES_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | — |

**Unique constraints:** `UQ_IDEMP_SCOPE` (`USER_ID, OPERATION, KEY_VALUE`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_IDEMP_HASH`: `REGEXP_LIKE(request_hash,'^[0-9a-f]{64}$')`
- `CK_IDEMP_STATE`: `state IN ('IN_PROGRESS','COMPLETED','FAILED')`
- `CK_IDEMP_EXPIRES`: `expires_at > created_at`

#### `PET_LISTING_LOCKS`

Single active adoption/sale listing claim for a given pet.

| Column | Oracle type | Null? | Key / reference | Default / notes |
|---|---|---|---|---|
| `PET_ID` | `NUMBER(19,0)` | No | PK; FK → `PETS.PET_ID` | — |
| `LISTING_TYPE` | `VARCHAR2(12 BYTE)` | No | UQ | — |
| `LISTING_ID` | `NUMBER(19,0)` | No | UQ | — |
| `CLAIMED_AT` | `TIMESTAMP(6) WITH TIME ZONE` | No | — | `SYSTIMESTAMP` |

**Unique constraints:** `UQ_LISTING_LOCK_TARGET` (`LISTING_TYPE, LISTING_ID`).

**Check constraints (exact logical expressions, whitespace condensed):**

- `CK_LISTING_LOCK_TYPE`: `listing_type IN ('ADOPTION','PET_SALE')`

## 4. Database views introduced in V012

| View | Public fields (per the source migration) |
|---|---|
| `VW_PUBLIC_ADOPTIONS` | Adoption ID, pet ID, title, species, general area, posted time; published only |
| `VW_PUBLIC_PET_SALES` | Sale listing ID, pet ID, title, species, general area, asking price/currency, posted time; active only |
| `VW_PUBLIC_LOST_FOUND` | Post ID, category, species, description, general area, approximate radius, observed/published time; open only |
| `VW_PUBLIC_FOOD` | Product ID, category, SKU, brand, title, description, target species, ingredients, allergens, weight, price/currency; active only |

These views intentionally omit private addresses, contact data, identity evidence, direct location coordinates and private adoption answers. **Still enforce role authorization and privacy review at the API.**

## 5. Reference and demonstration seed scope

- `seeds/001_reference_data.sql`: six stable `FOOD_CATEGORIES` slugs: `dog-food`, `cat-food`, `bird-food`, `fish-food`, `small-pet-food`, `pet-treats`. Insert-if-missing behavior.
- `seeds/002_demo_data_dev_only.sql`: fictional, non-production test entities. **Never** run against real or production data. Stored demo account hashes are intentionally unusable for authentication.

## 6. Constraint / reporting / operations boundaries

- Foreign keys are actual SQL `CONSTRAINT` declarations, but dynamic multi-table targets such as `FAVORITES` and `LISTING_REPORTS` cannot all be enforced by one conventional FK; authorization and target validity must be verified by API logic.
- Veterinary appointment interval overlap, duplicate listing publication, adoption/sale ownership changes, food-stock reservation, webhook verification, and payout/settlement require transactional service logic.
- `queries/dashboard_summary.sql`, `queries/pet_health_timeline.sql`, and `queries/store_sales_summary.sql` are read-only reports; they are not persisted views or migrations.
- The V012 public projections are database views; they are not necessarily exposed anonymously by the API.
- For the complete relationship list and diagrams, see [`ERD.md`](ERD.md). For deployment and recovery, see [`README.md`](README.md) and [`rollback/README.md`](rollback/README.md).

