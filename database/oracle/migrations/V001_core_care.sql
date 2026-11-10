-- =============================================================================
-- PawCare | Oracle SQL migration V001: core pet care
-- File: database/oracle/migrations/V001_core_care.sql
-- Supported: Oracle Database 19c+ (including Oracle Database Free PDB)
-- Run with: SQL*Plus or SQLcl, connected AS PAWCARE_APP after 000_create_schema.sql
--
-- Creates exactly seven core application tables:
--   USERS, PETS, VACCINATIONS, MEDICATIONS, CARE_TASKS, APPOINTMENTS, EXPENSES
-- Plus one internal SCHEMA_MIGRATIONS table for version/checksum tracking.
--
-- Deliberate design decisions:
--   * NUMBER(19) Oracle identity PKs; API must expose IDs as decimal strings,
--     because JavaScript numbers cannot safely represent all 64-bit IDs.
--   * EMAIL must be lowercase and trimmed BEFORE INSERT; reject duplicates.
--   * Times use TIMESTAMP WITH TIME ZONE; API normalizes to UTC on read/write.
--   * Money uses integer minor units + ISO 4217 currency code.
--   * Records are retained/archived where appropriate; DELETE policy is in API.
--   * Each CARE_TASKS row represents ONE occurrence. A scheduler may generate
--     future rows with a stable, globally unique occurrence_key to deduplicate.
--   * Exact-start double booking has a unique index for REQUESTED/CONFIRMED.
--     OVERLAPPING intervals with different start times still require the API
--     to lock the veterinarian's USERS row (SELECT ... FOR UPDATE), query for
--     overlapping active appointments and insert within the SAME transaction.
--   * Vet-role, pet ownership, and medical-author permissions need server-side
--     enforcement; ordinary foreign keys cannot enforce those permissions.
--   * No example users, passwords, sample medical records, or seed data.
--
-- Safety and execution:
--   * Run against the correct PDB as PAWCARE_APP, NOT a SYS/DBA login.
--   * Fails BEFORE creating objects if any V001 table already exists.
--   * Do not rerun against a partially migrated schema. Oracle DDL auto-commits;
--     manually inspect/reconcile any partial application before retrying.
--   * No DROP, TRUNCATE, GRANT, DELETE or overwrite of application data.
--   * Later versions must be applied in order, by a checksum-aware deploy step.
--   * SHA-256 in SCHEMA_MIGRATIONS covers only the exact UTF-8 bytes BETWEEN
--     the two V001 DDL marker lines below (excluding the marker lines).
-- =============================================================================

SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT PawCare | V001 core care: checking schema and existing objects ...

DECLARE
    v_conflicts NUMBER;
    v_user     VARCHAR2(128);
    v_schema   VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    v_schema := SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA');

    IF NVL(UPPER(v_user), 'UNKNOWN') <> 'PAWCARE_APP'
       OR NVL(UPPER(v_schema), 'UNKNOWN') <> 'PAWCARE_APP' THEN
        RAISE_APPLICATION_ERROR(
            -20101,
            'Connect as PAWCARE_APP with CURRENT_SCHEMA=PAWCARE_APP before V001.'
        );
    END IF;

    SELECT COUNT(*) INTO v_conflicts
      FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN (
           'SCHEMA_MIGRATIONS', 'USERS', 'PETS', 'VACCINATIONS',
           'MEDICATIONS', 'CARE_TASKS', 'APPOINTMENTS', 'EXPENSES'
       );

    IF v_conflicts <> 0 THEN
        RAISE_APPLICATION_ERROR(
            -20102,
            'V001 objects already exist. Stop: review migration state; do not rerun.'
        );
    END IF;

    DBMS_OUTPUT.PUT_LINE('Preflight passed for schema ' || v_schema || '.');
END;
/

-- BEGIN V001 DDL (checksum scope starts after this line)

-- Migration ledger: internal metadata, not an eighth pet-care feature.
CREATE TABLE SCHEMA_MIGRATIONS (
    migration_version VARCHAR2(32 BYTE) NOT NULL,
    description       VARCHAR2(160 BYTE) NOT NULL,
    provider          VARCHAR2(16 BYTE) DEFAULT 'ORACLE' NOT NULL,
    checksum_sha256   CHAR(64 BYTE) NOT NULL,
    applied_at        TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SCHEMA_MIGRATIONS PRIMARY KEY (migration_version),
    CONSTRAINT CK_MIGRATION_PROVIDER CHECK (provider = 'ORACLE'),
    CONSTRAINT CK_MIGRATION_SHA256 CHECK (
        REGEXP_LIKE(checksum_sha256, '^[0-9a-f]{64}$')
    )
);

-- 1. USERS: identity and platform roles. Approval of VET/ADMIN happens in API.
CREATE TABLE USERS (
    user_id           NUMBER(19,0) GENERATED ALWAYS AS IDENTITY
                      (START WITH 1 INCREMENT BY 1 CACHE 100),
    email             VARCHAR2(254 BYTE) NOT NULL,
    password_hash     VARCHAR2(255 BYTE) NOT NULL,
    role              VARCHAR2(8 BYTE) DEFAULT 'OWNER' NOT NULL,
    status            VARCHAR2(24 BYTE) DEFAULT 'PENDING_VERIFICATION' NOT NULL,
    email_verified_at TIMESTAMP(6) WITH TIME ZONE,
    created_at        TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at        TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USERS PRIMARY KEY (user_id),
    CONSTRAINT UQ_USERS_EMAIL UNIQUE (email),
    CONSTRAINT CK_USERS_EMAIL_CANON CHECK (
        email = LOWER(TRIM(email)) AND INSTR(email, '@') > 1
        AND INSTR(email, ' ') = 0
    ),
    CONSTRAINT CK_USERS_ROLE CHECK (role IN ('OWNER', 'VET', 'ADMIN')),
    CONSTRAINT CK_USERS_STATUS CHECK (status IN (
        'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'
    ))
);

-- 2. PETS: current owner, stable pet identity and soft-archive support.
--    Ownership transfers will be audited by later adoption/sale migrations.
CREATE TABLE PETS (
    pet_id         NUMBER(19,0) GENERATED ALWAYS AS IDENTITY
                   (START WITH 1 INCREMENT BY 1 CACHE 100),
    owner_user_id  NUMBER(19,0) NOT NULL,
    name           VARCHAR2(120 BYTE) NOT NULL,
    species        VARCHAR2(80 BYTE) NOT NULL,
    breed          VARCHAR2(120 BYTE),
    date_of_birth  DATE,
    sex            VARCHAR2(12 BYTE) DEFAULT 'UNKNOWN' NOT NULL,
    attributes_json VARCHAR2(4000 BYTE),
    status         VARCHAR2(12 BYTE) DEFAULT 'ACTIVE' NOT NULL,
    archived_at    TIMESTAMP(6) WITH TIME ZONE,
    created_at     TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at     TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_PETS PRIMARY KEY (pet_id),
    CONSTRAINT FK_PETS_OWNER FOREIGN KEY (owner_user_id)
        REFERENCES USERS (user_id),
    CONSTRAINT CK_PETS_SEX CHECK (sex IN ('MALE', 'FEMALE', 'UNKNOWN')),
    CONSTRAINT CK_PETS_STATUS CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DECEASED')),
    CONSTRAINT CK_PETS_ARCHIVE CHECK (
        (status = 'ARCHIVED' AND archived_at IS NOT NULL)
        OR (status <> 'ARCHIVED' AND archived_at IS NULL)
    ),
    CONSTRAINT CK_PETS_ATTRIBUTES_JSON CHECK (attributes_json IS JSON (STRICT))
);

-- 3. VACCINATIONS: records of administered vaccines and next due dates.
CREATE TABLE VACCINATIONS (
    vaccination_id       NUMBER(19,0) GENERATED ALWAYS AS IDENTITY
                         (START WITH 1 INCREMENT BY 1 CACHE 100),
    pet_id               NUMBER(19,0) NOT NULL,
    vaccine_name         VARCHAR2(160 BYTE) NOT NULL,
    administered_at      TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    next_due_at          TIMESTAMP(6) WITH TIME ZONE,
    veterinarian_user_id NUMBER(19,0),
    recorded_by_user_id  NUMBER(19,0) NOT NULL,
    notes                VARCHAR2(2000 BYTE),
    created_at           TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at           TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_VACCINATIONS PRIMARY KEY (vaccination_id),
    CONSTRAINT FK_VACC_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_VACC_VET FOREIGN KEY (veterinarian_user_id)
        REFERENCES USERS (user_id),
    CONSTRAINT FK_VACC_AUTHOR FOREIGN KEY (recorded_by_user_id)
        REFERENCES USERS (user_id),
    CONSTRAINT CK_VACC_DUE_AFTER_ADMIN CHECK (
        next_due_at IS NULL OR next_due_at >= administered_at
    )
);

-- 4. MEDICATIONS: prescribed/administered medication plans; no dosage inference.
CREATE TABLE MEDICATIONS (
    medication_id       NUMBER(19,0) GENERATED ALWAYS AS IDENTITY
                        (START WITH 1 INCREMENT BY 1 CACHE 100),
    pet_id              NUMBER(19,0) NOT NULL,
    medication_name     VARCHAR2(160 BYTE) NOT NULL,
    dosage_text         VARCHAR2(300 BYTE) NOT NULL,
    instructions        VARCHAR2(2000 BYTE),
    start_at            TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    end_at              TIMESTAMP(6) WITH TIME ZONE,
    schedule_rule       VARCHAR2(512 BYTE),
    status              VARCHAR2(12 BYTE) DEFAULT 'ACTIVE' NOT NULL,
    created_by_user_id  NUMBER(19,0) NOT NULL,
    created_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_MEDICATIONS PRIMARY KEY (medication_id),
    CONSTRAINT FK_MED_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_MED_AUTHOR FOREIGN KEY (created_by_user_id)
        REFERENCES USERS (user_id),
    CONSTRAINT CK_MED_DATES CHECK (end_at IS NULL OR end_at >= start_at),
    CONSTRAINT CK_MED_STATUS CHECK (status IN ('ACTIVE', 'COMPLETED', 'STOPPED'))
);

-- 5. CARE_TASKS: each row is a concrete due-time occurrence.
--    An optional occurrence_key identifies generated repeats idempotently.
--    A later worker/notification module supplies the generation algorithm.
CREATE TABLE CARE_TASKS (
    care_task_id        NUMBER(19,0) GENERATED ALWAYS AS IDENTITY
                        (START WITH 1 INCREMENT BY 1 CACHE 100),
    pet_id              NUMBER(19,0) NOT NULL,
    task_type           VARCHAR2(20 BYTE) NOT NULL,
    title               VARCHAR2(160 BYTE) NOT NULL,
    due_at              TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    recurrence_rule     VARCHAR2(512 BYTE),
    occurrence_key      VARCHAR2(160 BYTE),
    status              VARCHAR2(12 BYTE) DEFAULT 'PENDING' NOT NULL,
    completed_at        TIMESTAMP(6) WITH TIME ZONE,
    time_zone           VARCHAR2(64 BYTE) DEFAULT 'UTC' NOT NULL,
    created_by_user_id  NUMBER(19,0) NOT NULL,
    created_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_CARE_TASKS PRIMARY KEY (care_task_id),
    CONSTRAINT FK_CARE_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_CARE_AUTHOR FOREIGN KEY (created_by_user_id)
        REFERENCES USERS (user_id),
    CONSTRAINT UQ_CARE_OCCURRENCE_KEY UNIQUE (occurrence_key),
    CONSTRAINT CK_CARE_TYPE CHECK (task_type IN (
        'FEEDING', 'GROOMING', 'MEDICATION', 'EXERCISE', 'HYGIENE', 'OTHER'
    )),
    CONSTRAINT CK_CARE_STATUS CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT CK_CARE_COMPLETION CHECK (
        (status = 'COMPLETED' AND completed_at IS NOT NULL)
        OR (status <> 'COMPLETED' AND completed_at IS NULL)
    )
);

-- 6. APPOINTMENTS: vet visits, status, history and bounded time windows.
CREATE TABLE APPOINTMENTS (
    appointment_id      NUMBER(19,0) GENERATED ALWAYS AS IDENTITY
                        (START WITH 1 INCREMENT BY 1 CACHE 100),
    pet_id              NUMBER(19,0) NOT NULL,
    vet_user_id         NUMBER(19,0) NOT NULL,
    created_by_user_id  NUMBER(19,0) NOT NULL,
    starts_at           TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    ends_at             TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    status              VARCHAR2(12 BYTE) DEFAULT 'REQUESTED' NOT NULL,
    reason              VARCHAR2(1000 BYTE),
    visit_notes         CLOB,
    created_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_APPOINTMENTS PRIMARY KEY (appointment_id),
    CONSTRAINT FK_APPT_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_APPT_VET FOREIGN KEY (vet_user_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_APPT_AUTHOR FOREIGN KEY (created_by_user_id)
        REFERENCES USERS (user_id),
    CONSTRAINT CK_APPT_INTERVAL CHECK (ends_at > starts_at),
    CONSTRAINT CK_APPT_STATUS CHECK (status IN (
        'REQUESTED', 'CONFIRMED', 'COMPLETED',
        'CANCELLED', 'REJECTED', 'NO_SHOW'
    ))
);

-- 7. EXPENSES: private user-entered pet costs, never payment credentials.
CREATE TABLE EXPENSES (
    expense_id          NUMBER(19,0) GENERATED ALWAYS AS IDENTITY
                        (START WITH 1 INCREMENT BY 1 CACHE 100),
    pet_id              NUMBER(19,0) NOT NULL,
    amount_minor        NUMBER(18,0) NOT NULL,
    currency            CHAR(3 BYTE) DEFAULT 'BDT' NOT NULL,
    category            VARCHAR2(20 BYTE) NOT NULL,
    occurred_at         TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    description         VARCHAR2(2000 BYTE),
    created_by_user_id  NUMBER(19,0) NOT NULL,
    created_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at          TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_EXPENSES PRIMARY KEY (expense_id),
    CONSTRAINT FK_EXP_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_EXP_AUTHOR FOREIGN KEY (created_by_user_id)
        REFERENCES USERS (user_id),
    CONSTRAINT CK_EXP_AMOUNT CHECK (amount_minor >= 0),
    CONSTRAINT CK_EXP_CURRENCY CHECK (REGEXP_LIKE(currency, '^[A-Z]{3}$')),
    CONSTRAINT CK_EXP_CATEGORY CHECK (category IN (
        'FOOD', 'VET', 'MEDICATION', 'GROOMING', 'TOYS', 'SUPPLIES', 'OTHER'
    ))
);

-- Query-support and FK indexes: avoid unnecessary full scans/parent-row locks.
CREATE INDEX IX_USERS_ROLE_STATUS        ON USERS (role, status);
CREATE INDEX IX_PETS_OWNER_STATUS        ON PETS (owner_user_id, status);
CREATE INDEX IX_VACC_PET_ADMIN           ON VACCINATIONS (pet_id, administered_at);
CREATE INDEX IX_VACC_VET                 ON VACCINATIONS (veterinarian_user_id);
CREATE INDEX IX_VACC_AUTHOR              ON VACCINATIONS (recorded_by_user_id);
CREATE INDEX IX_MED_PET_STATUS           ON MEDICATIONS (pet_id, status, start_at);
CREATE INDEX IX_MED_AUTHOR               ON MEDICATIONS (created_by_user_id);
CREATE INDEX IX_CARE_PET_DUE             ON CARE_TASKS (pet_id, status, due_at);
CREATE INDEX IX_CARE_AUTHOR              ON CARE_TASKS (created_by_user_id);
CREATE INDEX IX_APPT_PET_START           ON APPOINTMENTS (pet_id, starts_at);
CREATE INDEX IX_APPT_VET_START           ON APPOINTMENTS (vet_user_id, starts_at, status);
CREATE INDEX IX_APPT_AUTHOR              ON APPOINTMENTS (created_by_user_id);
CREATE INDEX IX_EXP_PET_OCCUR            ON EXPENSES (pet_id, occurred_at);
CREATE INDEX IX_EXP_AUTHOR               ON EXPENSES (created_by_user_id);

-- Oracle-specific partial-uniqueness simulation. Prevents two active bookings
-- starting at precisely the same time for the same vet; not arbitrary overlap.
CREATE UNIQUE INDEX UX_APPT_ACTIVE_VET_START ON APPOINTMENTS (
    CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN vet_user_id END,
    CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN starts_at END
);

-- Server-managed last-modified timestamps. These are not audit trails.
CREATE OR REPLACE TRIGGER TRG_USERS_UPDATED_AT
    BEFORE UPDATE ON USERS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_PETS_UPDATED_AT
    BEFORE UPDATE ON PETS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_VACC_UPDATED_AT
    BEFORE UPDATE ON VACCINATIONS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_MED_UPDATED_AT
    BEFORE UPDATE ON MEDICATIONS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_CARE_UPDATED_AT
    BEFORE UPDATE ON CARE_TASKS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_APPT_UPDATED_AT
    BEFORE UPDATE ON APPOINTMENTS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_EXP_UPDATED_AT
    BEFORE UPDATE ON EXPENSES FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- END V001 DDL (checksum scope ends before this line)

-- Record exactly what was applied, not an invented or placeholder hash.
-- Hash source: UTF-8 bytes between the two V001 DDL marker lines above.
INSERT INTO SCHEMA_MIGRATIONS (
    migration_version, description, provider, checksum_sha256
) VALUES (
    'V001', 'Core care: seven original tables', 'ORACLE',
    'fef2db2ea4e267789fda1d6307d2ac87d98156355b16d190bd602e10d62b15e1'
);
COMMIT;

PROMPT PawCare | V001: validating installed tables, triggers and version ...
DECLARE
    v_tables    NUMBER;
    v_triggers  NUMBER;
    v_migration NUMBER;
    v_invalid   NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables
      FROM USER_TABLES
     WHERE TABLE_NAME IN (
         'SCHEMA_MIGRATIONS', 'USERS', 'PETS', 'VACCINATIONS',
         'MEDICATIONS', 'CARE_TASKS', 'APPOINTMENTS', 'EXPENSES'
     );
    SELECT COUNT(*) INTO v_triggers
      FROM USER_TRIGGERS
     WHERE TRIGGER_NAME IN (
         'TRG_USERS_UPDATED_AT', 'TRG_PETS_UPDATED_AT',
         'TRG_VACC_UPDATED_AT', 'TRG_MED_UPDATED_AT',
         'TRG_CARE_UPDATED_AT', 'TRG_APPT_UPDATED_AT',
         'TRG_EXP_UPDATED_AT'
     );
    SELECT COUNT(*) INTO v_invalid
      FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TRIGGER'
       AND OBJECT_NAME IN (
         'TRG_USERS_UPDATED_AT', 'TRG_PETS_UPDATED_AT',
         'TRG_VACC_UPDATED_AT', 'TRG_MED_UPDATED_AT',
         'TRG_CARE_UPDATED_AT', 'TRG_APPT_UPDATED_AT',
         'TRG_EXP_UPDATED_AT'
       )
       AND STATUS <> 'VALID';
    SELECT COUNT(*) INTO v_migration
      FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V001';

    IF v_tables <> 8 OR v_triggers <> 7 OR v_invalid <> 0
       OR v_migration <> 1 THEN
        RAISE_APPLICATION_ERROR(-20103,
            'V001 postflight failed: inspect tables, triggers and ledger.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS: 7 core tables + 1 migration ledger.');
    DBMS_OUTPUT.PUT_LINE('PASS: 7 valid updated_at triggers.');
    DBMS_OUTPUT.PUT_LINE('PASS: SCHEMA_MIGRATIONS/V001 recorded.');
END;
/

PROMPT V001 complete. Next planned migration: V002_identity_profiles.sql
