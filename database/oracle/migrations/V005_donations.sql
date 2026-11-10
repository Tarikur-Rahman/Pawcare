-- ============================================================================
-- PawCare | Oracle migration V005: Optional monetary donations
-- File: database/oracle/migrations/V005_donations.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V004.
-- Dependencies: V001 through V004; execute in strict numeric order.
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

PROMPT PawCare | V005 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20005,
           'V005: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004');
    IF v_predecessors <> 4 THEN
       RAISE_APPLICATION_ERROR(-20005,
           'V005: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V005';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20005,
           'V005 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('DONATION_CAMPAIGNS', 'DONATION_CONTRIBUTIONS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20005,
           'V005: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V005: preflight passed.');
END;
/

-- BEGIN V005 DDL (checksum scope starts after this line)

-- Optional monetary fundraising: feature flag OFF until compliance, verification,
-- receipts/refund policy, provider agreement and user terms are approved.
-- Pet donation/rehoming remains available through V004 without money.
CREATE TABLE DONATION_CAMPAIGNS (
    campaign_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    beneficiary_id NUMBER(19,0) NOT NULL,
    purpose VARCHAR2(2000 BYTE) NOT NULL,
    title VARCHAR2(200 BYTE) NOT NULL,
    goal_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) DEFAULT 'BDT' NOT NULL,
    verification_status VARCHAR2(12 BYTE) DEFAULT 'PENDING' NOT NULL,
    status VARCHAR2(20 BYTE) DEFAULT 'DRAFT' NOT NULL,
    reviewed_by_user_id NUMBER(19,0),
    reviewed_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_DONATION_CAMPAIGNS PRIMARY KEY (campaign_id),
    CONSTRAINT FK_DONATION_BEN FOREIGN KEY (beneficiary_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_DONATION_REVIEW FOREIGN KEY (reviewed_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_DONATION_GOAL CHECK (goal_minor > 0),
    CONSTRAINT CK_DONATION_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$')),
    CONSTRAINT CK_DONATION_VERIFY CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
    CONSTRAINT CK_DONATION_STATUS CHECK (status IN ('DRAFT','PENDING_REVIEW','PUBLISHED','PAUSED','CLOSED','REJECTED')),
    CONSTRAINT CK_DONATION_PUBLISH CHECK (status <> 'PUBLISHED' OR
      (verification_status = 'VERIFIED' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IX_DONATION_BEN ON DONATION_CAMPAIGNS (beneficiary_id, status);
CREATE INDEX IX_DONATION_PUBLIC ON DONATION_CAMPAIGNS (status, created_at);
CREATE INDEX IX_DONATION_REVIEW ON DONATION_CAMPAIGNS (reviewed_by_user_id);

CREATE TABLE DONATION_CONTRIBUTIONS (
    contribution_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    campaign_id NUMBER(19,0) NOT NULL,
    donor_id NUMBER(19,0),
    amount_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) NOT NULL,
    payment_state VARCHAR2(12 BYTE) DEFAULT 'PENDING' NOT NULL,
    provider_code VARCHAR2(40 BYTE),
    provider_ref VARCHAR2(160 BYTE),
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    settled_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_DONATION_CONTRIB PRIMARY KEY (contribution_id),
    CONSTRAINT FK_CONTRIB_CAMPAIGN FOREIGN KEY (campaign_id) REFERENCES DONATION_CAMPAIGNS (campaign_id),
    CONSTRAINT FK_CONTRIB_DONOR FOREIGN KEY (donor_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_CONTRIB_AMOUNT CHECK (amount_minor > 0),
    CONSTRAINT CK_CONTRIB_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$')),
    CONSTRAINT CK_CONTRIB_STATE CHECK (payment_state IN ('PENDING','SUCCEEDED','FAILED','REFUNDED')),
    CONSTRAINT CK_CONTRIB_SETTLED CHECK (payment_state <> 'SUCCEEDED' OR settled_at IS NOT NULL),
    CONSTRAINT CK_CONTRIB_PROVIDER CHECK (provider_ref IS NULL OR provider_code IS NOT NULL)
);
CREATE UNIQUE INDEX UX_CONTRIB_PROVIDER_REF ON DONATION_CONTRIBUTIONS (provider_code, provider_ref);
CREATE INDEX IX_CONTRIB_CAMPAIGN ON DONATION_CONTRIBUTIONS (campaign_id, created_at);
CREATE INDEX IX_CONTRIB_DONOR ON DONATION_CONTRIBUTIONS (donor_id, created_at);
CREATE OR REPLACE TRIGGER TRG_DONATIONS_UPD
    BEFORE UPDATE ON DONATION_CAMPAIGNS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V005 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V005', 'Optional monetary donations', 'ORACLE',
     '3355a2d2b3780622ff300dfb1d280d374d96f037fe7d9908d258ae3bddc7a165');
COMMIT;

PROMPT PawCare | V005 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('DONATION_CAMPAIGNS', 'DONATION_CONTRIBUTIONS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V005';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 2
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20005, 'V005: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V005: 2 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V005 complete.
