-- ============================================================================
-- PawCare | Oracle migration V002: Identity profiles and access
-- File: database/oracle/migrations/V002_identity_profiles.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V001.
-- Dependencies: V001 through V001; execute in strict numeric order.
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

PROMPT PawCare | V002 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20002,
           'V002: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001');
    IF v_predecessors <> 1 THEN
       RAISE_APPLICATION_ERROR(-20002,
           'V002: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V002';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20002,
           'V002 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('USER_PROFILES', 'USER_CAPABILITIES', 'SESSIONS', 'ADDRESSES')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20002,
           'V002: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V002: preflight passed.');
END;
/

-- BEGIN V002 DDL (checksum scope starts after this line)

-- User contact information remains private and is never part of public listings.
CREATE TABLE USER_PROFILES (
    user_id NUMBER(19,0) NOT NULL,
    display_name VARCHAR2(120 BYTE) NOT NULL,
    phone_e164 VARCHAR2(20 BYTE),
    preferred_time_zone VARCHAR2(64 BYTE) DEFAULT 'Asia/Dhaka' NOT NULL,
    preferred_locale VARCHAR2(16 BYTE) DEFAULT 'en' NOT NULL,
    notification_preferences_json VARCHAR2(4000 BYTE),
    avatar_file_id NUMBER(19,0), -- Linked to FILE_ASSETS after V003 by the service layer.
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_USER_PROFILES PRIMARY KEY (user_id),
    CONSTRAINT FK_PROFILE_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_PROFILE_PREF_JSON CHECK (notification_preferences_json IS JSON (STRICT)),
    CONSTRAINT CK_PROFILE_PHONE CHECK (phone_e164 IS NULL OR REGEXP_LIKE(phone_e164, '^\+[1-9][0-9]{6,14}$'))
);

-- Additional privileges are revocable grants, NOT new USERS.role values.
CREATE TABLE USER_CAPABILITIES (
    capability_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    capability VARCHAR2(32 BYTE) NOT NULL,
    status VARCHAR2(12 BYTE) DEFAULT 'ACTIVE' NOT NULL,
    granted_by_user_id NUMBER(19,0) NOT NULL,
    granted_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE,
    revoked_at TIMESTAMP(6) WITH TIME ZONE,
    reason_code VARCHAR2(80 BYTE),
    CONSTRAINT PK_USER_CAPABILITIES PRIMARY KEY (capability_id),
    CONSTRAINT FK_CAP_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_CAP_GRANTOR FOREIGN KEY (granted_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_CAP_VALUE CHECK (capability IN (
       'APPROVED_SELLER','STORE_OPERATOR','VERIFIED_BENEFICIARY')),
    CONSTRAINT CK_CAP_STATUS CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
    CONSTRAINT CK_CAP_REVOKED CHECK (
        (status = 'REVOKED' AND revoked_at IS NOT NULL)
        OR (status <> 'REVOKED' AND revoked_at IS NULL)),
    CONSTRAINT CK_CAP_EXPIRY CHECK (expires_at IS NULL OR expires_at > granted_at)
);
CREATE UNIQUE INDEX UX_CAP_ACTIVE ON USER_CAPABILITIES (
    CASE WHEN status = 'ACTIVE' THEN user_id END,
    CASE WHEN status = 'ACTIVE' THEN capability END
);
CREATE INDEX IX_CAP_USER ON USER_CAPABILITIES (user_id, capability, status);
CREATE INDEX IX_CAP_GRANTOR ON USER_CAPABILITIES (granted_by_user_id);

-- Only SHA-256 / stronger token hashes are stored, never raw refresh tokens.
CREATE TABLE SESSIONS (
    session_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    refresh_token_hash CHAR(64 BYTE) NOT NULL,
    device_label VARCHAR2(140 BYTE),
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    rotated_at TIMESTAMP(6) WITH TIME ZONE,
    revoked_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_SESSIONS PRIMARY KEY (session_id),
    CONSTRAINT FK_SESSION_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_SESSION_TOKEN_HASH UNIQUE (refresh_token_hash),
    CONSTRAINT CK_SESSION_HASH CHECK (REGEXP_LIKE(refresh_token_hash,'^[0-9a-f]{64}$')),
    CONSTRAINT CK_SESSION_EXP CHECK (expires_at > created_at)
);
CREATE INDEX IX_SESSIONS_USER ON SESSIONS (user_id, revoked_at, expires_at);

-- Shipping addresses are never returned from public user/listing projections.
CREATE TABLE ADDRESSES (
    address_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    recipient_name VARCHAR2(160 BYTE) NOT NULL,
    phone_e164 VARCHAR2(20 BYTE),
    line_1 VARCHAR2(200 BYTE) NOT NULL,
    line_2 VARCHAR2(200 BYTE),
    city VARCHAR2(100 BYTE) NOT NULL,
    region VARCHAR2(120 BYTE),
    postal_code VARCHAR2(24 BYTE),
    country_code CHAR(2 BYTE) DEFAULT 'BD' NOT NULL,
    scope VARCHAR2(12 BYTE) DEFAULT 'SHIPPING' NOT NULL,
    is_default NUMBER(1) DEFAULT 0 NOT NULL,
    status VARCHAR2(12 BYTE) DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_ADDRESSES PRIMARY KEY (address_id),
    CONSTRAINT FK_ADDRESS_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_ADDR_COUNTRY CHECK (REGEXP_LIKE(country_code,'^[A-Z]{2}$')),
    CONSTRAINT CK_ADDR_SCOPE CHECK (scope IN ('SHIPPING','BILLING')),
    CONSTRAINT CK_ADDR_DEFAULT CHECK (is_default IN (0,1)),
    CONSTRAINT CK_ADDR_STATUS CHECK (status IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT CK_ADDR_PHONE CHECK (phone_e164 IS NULL OR REGEXP_LIKE(phone_e164,'^\+[1-9][0-9]{6,14}$'))
);
CREATE UNIQUE INDEX UX_ADDR_ONE_DEFAULT ON ADDRESSES (
   CASE WHEN is_default=1 AND status='ACTIVE' THEN user_id END,
   CASE WHEN is_default=1 AND status='ACTIVE' THEN scope END
);
CREATE INDEX IX_ADDRESSES_USER ON ADDRESSES (user_id, status);

CREATE OR REPLACE TRIGGER TRG_PROFILES_UPD
    BEFORE UPDATE ON USER_PROFILES FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_ADDRESSES_UPD
    BEFORE UPDATE ON ADDRESSES FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V002 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V002', 'Identity profiles and access', 'ORACLE',
     '7dd3cf6be4820d1cc27271840c1712e5a45897163ded0ae95480f96519bbea46');
COMMIT;

PROMPT PawCare | V002 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('USER_PROFILES', 'USER_CAPABILITIES', 'SESSIONS', 'ADDRESSES');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V002';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 4
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20002, 'V002: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V002: 4 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V002 complete.
