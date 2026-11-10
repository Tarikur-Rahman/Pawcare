-- ============================================================================
-- PawCare | Oracle migration V012: Outbox, replay keys, final indexes
-- File: database/oracle/migrations/V012_outbox_keys_indexes.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V011.
-- Dependencies: V001 through V011; execute in strict numeric order.
-- No seed data, DROP, TRUNCATE, or elevation of schema privileges.
-- All monetary values in integer minor units + ISO currency codes.
-- UTC exchange at API edge; database timestamps include time-zone offset.
-- This migration is NOT transactionally atomic: Oracle DDL auto-commits.
-- Stop on failure; inspect a partial deployment before retrying.
-- The SHA-256 below covers exact UTF-8 bytes between the DDL marker lines
-- (not including marker lines); keep deployed versions immutable.
-- ============================================================================

SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT PawCare | V012 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20012,
           'V012: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007', 'V008', 'V009', 'V010', 'V011');
    IF v_predecessors <> 11 THEN
       RAISE_APPLICATION_ERROR(-20012,
           'V012: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V012';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20012,
           'V012 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('OUTBOX_EVENTS', 'IDEMPOTENCY_KEYS', 'PET_LISTING_LOCKS', 'VW_PUBLIC_ADOPTIONS', 'VW_PUBLIC_PET_SALES', 'VW_PUBLIC_LOST_FOUND', 'VW_PUBLIC_FOOD')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20012,
           'V012: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V012: preflight passed.');
END;
/

-- BEGIN V012 DDL (checksum scope starts after this line)

-- Consumer must claim work atomically, apply bounded retries/backoff and
-- write processed_at only after successful delivery. Never store secrets/PII.
CREATE TABLE OUTBOX_EVENTS (
    event_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    event_kind VARCHAR2(100 BYTE) NOT NULL,
    aggregate_type VARCHAR2(60 BYTE) NOT NULL,
    aggregate_id VARCHAR2(80 BYTE) NOT NULL,
    payload_json CLOB NOT NULL,
    dedupe_key VARCHAR2(180 BYTE) NOT NULL,
    status VARCHAR2(14 BYTE) DEFAULT 'PENDING' NOT NULL,
    retry_count NUMBER(8,0) DEFAULT 0 NOT NULL,
    next_attempt_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    processed_at TIMESTAMP(6) WITH TIME ZONE,
    last_error_code VARCHAR2(80 BYTE),
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_OUTBOX_EVENTS PRIMARY KEY (event_id),
    CONSTRAINT UQ_OUTBOX_DEDUPE UNIQUE (dedupe_key),
    CONSTRAINT CK_OUTBOX_JSON CHECK (payload_json IS JSON (STRICT)),
    CONSTRAINT CK_OUTBOX_STATUS CHECK (status IN ('PENDING','PROCESSING','SENT','DEAD')),
    CONSTRAINT CK_OUTBOX_RETRY CHECK (retry_count >= 0),
    CONSTRAINT CK_OUTBOX_COMPLETE CHECK (status <> 'SENT' OR processed_at IS NOT NULL)
);
CREATE INDEX IX_OUTBOX_DUE ON OUTBOX_EVENTS (status,next_attempt_at);
CREATE INDEX IX_OUTBOX_AGG ON OUTBOX_EVENTS (aggregate_type,aggregate_id);

-- Prevent duplicate checkout/handover on retries. TTL must not expire while
-- an operation is still in-flight; request hash is checked on key reuse.
CREATE TABLE IDEMPOTENCY_KEYS (
    key_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    operation VARCHAR2(80 BYTE) NOT NULL,
    key_value VARCHAR2(160 BYTE) NOT NULL,
    request_hash CHAR(64 BYTE) NOT NULL,
    response_ref VARCHAR2(160 BYTE),
    state VARCHAR2(16 BYTE) DEFAULT 'IN_PROGRESS' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT PK_IDEMPOTENCY_KEYS PRIMARY KEY (key_id),
    CONSTRAINT FK_IDEMP_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_IDEMP_SCOPE UNIQUE (user_id,operation,key_value),
    CONSTRAINT CK_IDEMP_HASH CHECK (REGEXP_LIKE(request_hash,'^[0-9a-f]{64}$')),
    CONSTRAINT CK_IDEMP_STATE CHECK (state IN ('IN_PROGRESS','COMPLETED','FAILED')),
    CONSTRAINT CK_IDEMP_EXPIRES CHECK (expires_at > created_at)
);
CREATE INDEX IX_IDEMP_EXPIRY ON IDEMPOTENCY_KEYS (expires_at,state);

-- One active exposure claim per known pet across adoption + sale listing.
-- API must SELECT ... FOR UPDATE on PETS, claim before publication/reservation,
-- and release only when listing is withdrawn/completed in SAME transaction.
-- This prevents a duplicate claim, not direct bypasses of workflow rules.
CREATE TABLE PET_LISTING_LOCKS (
    pet_id NUMBER(19,0) NOT NULL,
    listing_type VARCHAR2(12 BYTE) NOT NULL,
    listing_id NUMBER(19,0) NOT NULL,
    claimed_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_PET_LISTING_LOCKS PRIMARY KEY (pet_id),
    CONSTRAINT FK_LISTING_LOCK_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT CK_LISTING_LOCK_TYPE CHECK (listing_type IN ('ADOPTION','PET_SALE')),
    CONSTRAINT UQ_LISTING_LOCK_TARGET UNIQUE (listing_type,listing_id)
);

-- Safe public projections intentionally exclude private contacts, address,
-- proof documents, adopter answers, direct location coordinates and identity.
CREATE OR REPLACE VIEW VW_PUBLIC_ADOPTIONS AS
SELECT adoption_id, pet_id, title, species, general_area, posted_at
  FROM ADOPTION_LISTINGS WHERE status = 'PUBLISHED';

CREATE OR REPLACE VIEW VW_PUBLIC_PET_SALES AS
SELECT sale_listing_id, pet_id, title, species, general_area,
       asking_minor, currency, posted_at
  FROM PET_SALE_LISTINGS WHERE status = 'ACTIVE';

CREATE OR REPLACE VIEW VW_PUBLIC_LOST_FOUND AS
SELECT post_id, category, species, description, general_area,
       approximate_radius_km, observed_at, published_at
  FROM LOST_FOUND_POSTS WHERE status = 'OPEN';

CREATE OR REPLACE VIEW VW_PUBLIC_FOOD AS
SELECT product_id, category_id, sku, brand, title, description,
       target_species, ingredients_text, allergen_text, net_weight_grams,
       price_minor, currency
  FROM FOOD_PRODUCTS WHERE status = 'ACTIVE';

-- Supporting indexes for permission scoping, moderation and cleanup.
CREATE INDEX IX_PROFILE_UPDATED ON USER_PROFILES (updated_at);
CREATE INDEX IX_APPT_ACTIVE_VET ON APPOINTMENTS (status,vet_user_id,starts_at);
CREATE INDEX IX_ADOPT_STATUS_SPECIES ON ADOPTION_LISTINGS (status,species);
CREATE INDEX IX_SALE_STATUS_SPECIES ON PET_SALE_LISTINGS (status,species);
CREATE INDEX IX_LOST_STATUS_SPECIES ON LOST_FOUND_POSTS (status,species);
CREATE INDEX IX_ORDERS_UPDATED ON ORDERS (updated_at);


-- END V012 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V012', 'Outbox, replay keys, final indexes', 'ORACLE',
     'cd28feb4529e134d6bfe9072e9be1af2250d1ab98784b6bab4180940b2de1507');
COMMIT;

PROMPT PawCare | V012 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('OUTBOX_EVENTS', 'IDEMPOTENCY_KEYS', 'PET_LISTING_LOCKS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('VW_PUBLIC_ADOPTIONS', 'VW_PUBLIC_PET_SALES', 'VW_PUBLIC_LOST_FOUND', 'VW_PUBLIC_FOOD');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V012';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 3
       OR v_views <> 4
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20012, 'V012: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V012: 3 table(s), 4 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V012 complete.
