-- ============================================================================
-- PawCare | Oracle migration V003: Media, notifications and audit
-- File: database/oracle/migrations/V003_assets_notifications_audit.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V002.
-- Dependencies: V001 through V002; execute in strict numeric order.
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

PROMPT PawCare | V003 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20003,
           'V003: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002');
    IF v_predecessors <> 2 THEN
       RAISE_APPLICATION_ERROR(-20003,
           'V003: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V003';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20003,
           'V003 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('FILE_ASSETS', 'NOTIFICATIONS', 'DEVICE_TOKENS', 'AUDIT_EVENTS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20003,
           'V003: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V003: preflight passed.');
END;
/

-- BEGIN V003 DDL (checksum scope starts after this line)

-- Store storage keys, not image binaries or public unauthenticated URLs.
CREATE TABLE FILE_ASSETS (
    file_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    owner_user_id NUMBER(19,0) NOT NULL,
    object_key VARCHAR2(512 BYTE) NOT NULL,
    mime_type VARCHAR2(120 BYTE) NOT NULL,
    size_bytes NUMBER(18,0) NOT NULL,
    sha256_hex CHAR(64 BYTE) NOT NULL,
    access_policy VARCHAR2(20 BYTE) DEFAULT 'PRIVATE' NOT NULL,
    scan_status VARCHAR2(16 BYTE) DEFAULT 'PENDING' NOT NULL,
    exif_stripped NUMBER(1) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    deleted_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_FILE_ASSETS PRIMARY KEY (file_id),
    CONSTRAINT FK_FILE_OWNER FOREIGN KEY (owner_user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_FILE_OBJECT_KEY UNIQUE (object_key),
    CONSTRAINT CK_FILE_SIZE CHECK (size_bytes > 0),
    CONSTRAINT CK_FILE_SHA CHECK (REGEXP_LIKE(sha256_hex,'^[0-9a-f]{64}$')),
    CONSTRAINT CK_FILE_POLICY CHECK (access_policy IN ('PRIVATE','REVIEWER_ONLY','PUBLIC_APPROVED')),
    CONSTRAINT CK_FILE_SCAN CHECK (scan_status IN ('PENDING','SAFE','BLOCKED')),
    CONSTRAINT CK_FILE_EXIF CHECK (exif_stripped IN (0,1)),
    CONSTRAINT CK_FILE_PUBLIC CHECK (access_policy <> 'PUBLIC_APPROVED' OR
      (scan_status = 'SAFE' AND exif_stripped=1 AND deleted_at IS NULL))
);
CREATE INDEX IX_ASSET_OWNER ON FILE_ASSETS (owner_user_id, created_at);
CREATE INDEX IX_ASSET_SCAN ON FILE_ASSETS (scan_status, access_policy);

-- Optional avatar link added after assets exist; protects referenced file ID.
ALTER TABLE USER_PROFILES ADD CONSTRAINT FK_PROFILE_AVATAR
  FOREIGN KEY (avatar_file_id) REFERENCES FILE_ASSETS (file_id);

CREATE TABLE NOTIFICATIONS (
    notification_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    kind VARCHAR2(40 BYTE) NOT NULL,
    title VARCHAR2(160 BYTE) NOT NULL,
    body_text VARCHAR2(500 BYTE),
    payload_json VARCHAR2(4000 BYTE),
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    read_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_NOTIFICATIONS PRIMARY KEY (notification_id),
    CONSTRAINT FK_NOTIF_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_NOTIF_JSON CHECK (payload_json IS JSON (STRICT))
);
CREATE INDEX IX_NOTIF_USER_UNREAD ON NOTIFICATIONS (user_id, read_at, created_at);

-- Encrypted token payload handled by API/KMS; hash supports de-duplication.
CREATE TABLE DEVICE_TOKENS (
    token_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    platform VARCHAR2(12 BYTE) NOT NULL,
    token_hash CHAR(64 BYTE) NOT NULL,
    token_ciphertext VARCHAR2(4000 BYTE) NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    last_seen_at TIMESTAMP(6) WITH TIME ZONE,
    revoked_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_DEVICE_TOKENS PRIMARY KEY (token_id),
    CONSTRAINT FK_DEVICE_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_DEVICE_HASH UNIQUE (token_hash),
    CONSTRAINT CK_DEVICE_PLATFORM CHECK (platform IN ('ANDROID','IOS','WEB')),
    CONSTRAINT CK_DEVICE_SHA CHECK (REGEXP_LIKE(token_hash,'^[0-9a-f]{64}$'))
);
CREATE INDEX IX_DEVICE_USER ON DEVICE_TOKENS (user_id, revoked_at);

-- Append-only by application policy and restricted runtime credentials.
CREATE TABLE AUDIT_EVENTS (
    audit_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    actor_user_id NUMBER(19,0),
    action VARCHAR2(100 BYTE) NOT NULL,
    entity_type VARCHAR2(50 BYTE) NOT NULL,
    entity_id VARCHAR2(80 BYTE) NOT NULL,
    reason_code VARCHAR2(80 BYTE),
    request_id VARCHAR2(120 BYTE),
    details_json VARCHAR2(4000 BYTE),
    happened_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_AUDIT_EVENTS PRIMARY KEY (audit_id),
    CONSTRAINT FK_AUDIT_ACTOR FOREIGN KEY (actor_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_AUDIT_JSON CHECK (details_json IS JSON (STRICT))
);
CREATE INDEX IX_AUDIT_ENTITY ON AUDIT_EVENTS (entity_type, entity_id, happened_at);
CREATE INDEX IX_AUDIT_ACTOR ON AUDIT_EVENTS (actor_user_id, happened_at);


-- END V003 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V003', 'Media, notifications and audit', 'ORACLE',
     '26729665ff7d57bbe61a9bf590fc5e144e653d2a469abc55c22a62572bd24d0e');
COMMIT;

PROMPT PawCare | V003 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('FILE_ASSETS', 'NOTIFICATIONS', 'DEVICE_TOKENS', 'AUDIT_EVENTS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V003';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 4
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20003, 'V003: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V003: 4 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V003 complete.
