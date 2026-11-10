-- ============================================================================
-- PawCare | Oracle migration V006: Approved animal listings and sales
-- File: database/oracle/migrations/V006_pet_marketplace.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V005.
-- Dependencies: V001 through V005; execute in strict numeric order.
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

PROMPT PawCare | V006 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20006,
           'V006: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004', 'V005');
    IF v_predecessors <> 5 THEN
       RAISE_APPLICATION_ERROR(-20006,
           'V006: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V006';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20006,
           'V006 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('PET_SALE_LISTINGS', 'PET_SALE_MEDIA', 'PET_SALE_INQUIRIES', 'PET_SALE_TRANSACTIONS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20006,
           'V006: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V006: preflight passed.');
END;
/

-- BEGIN V006 DDL (checksum scope starts after this line)

-- Lawful animal sale is moderated and restricted to approved sellers.
-- No live-animal shipping/food-store payment pipeline is created here.
CREATE TABLE PET_SALE_LISTINGS (
    sale_listing_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    pet_id NUMBER(19,0) NOT NULL,
    seller_id NUMBER(19,0) NOT NULL,
    title VARCHAR2(180 BYTE) NOT NULL,
    description VARCHAR2(4000 BYTE) NOT NULL,
    species VARCHAR2(80 BYTE) NOT NULL,
    general_area VARCHAR2(160 BYTE) NOT NULL,
    asking_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) DEFAULT 'BDT' NOT NULL,
    welfare_evidence_file_id NUMBER(19,0),
    status VARCHAR2(20 BYTE) DEFAULT 'DRAFT' NOT NULL,
    reviewed_by_user_id NUMBER(19,0),
    reviewed_at TIMESTAMP(6) WITH TIME ZONE,
    posted_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_PET_SALE_LISTINGS PRIMARY KEY (sale_listing_id),
    CONSTRAINT FK_SALE_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_SALE_SELLER FOREIGN KEY (seller_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_SALE_EVIDENCE FOREIGN KEY (welfare_evidence_file_id) REFERENCES FILE_ASSETS (file_id),
    CONSTRAINT FK_SALE_REVIEWER FOREIGN KEY (reviewed_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_SALE_AMOUNT CHECK (asking_minor >= 0),
    CONSTRAINT CK_SALE_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$')),
    CONSTRAINT CK_SALE_STATUS CHECK (status IN (
       'DRAFT','PENDING_REVIEW','ACTIVE','RESERVED','SOLD','REJECTED','REMOVED')),
    CONSTRAINT CK_SALE_PUBLISHED CHECK (status <> 'ACTIVE' OR
      (welfare_evidence_file_id IS NOT NULL AND reviewed_by_user_id IS NOT NULL
       AND reviewed_at IS NOT NULL AND posted_at IS NOT NULL))
);
CREATE INDEX IX_SALE_PUBLIC ON PET_SALE_LISTINGS (status, posted_at);
CREATE INDEX IX_SALE_SELLER ON PET_SALE_LISTINGS (seller_id, status);
CREATE INDEX IX_SALE_PET ON PET_SALE_LISTINGS (pet_id, status);
CREATE INDEX IX_SALE_EVIDENCE ON PET_SALE_LISTINGS (welfare_evidence_file_id);
CREATE INDEX IX_SALE_REVIEWER ON PET_SALE_LISTINGS (reviewed_by_user_id);
-- One open, uncompleted sale listing per pet within the sale subsystem.
CREATE UNIQUE INDEX UX_SALE_OPEN_PET ON PET_SALE_LISTINGS (
  CASE WHEN status IN ('DRAFT','PENDING_REVIEW','ACTIVE','RESERVED') THEN pet_id END
);

CREATE TABLE PET_SALE_MEDIA (
    sale_media_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    sale_listing_id NUMBER(19,0) NOT NULL,
    file_id NUMBER(19,0) NOT NULL,
    sort_order NUMBER(5,0) DEFAULT 0 NOT NULL,
    CONSTRAINT PK_SALE_MEDIA PRIMARY KEY (sale_media_id),
    CONSTRAINT FK_SALE_MEDIA_LISTING FOREIGN KEY (sale_listing_id) REFERENCES PET_SALE_LISTINGS (sale_listing_id),
    CONSTRAINT FK_SALE_MEDIA_FILE FOREIGN KEY (file_id) REFERENCES FILE_ASSETS (file_id),
    CONSTRAINT UQ_SALE_MEDIA_FILE UNIQUE (sale_listing_id, file_id),
    CONSTRAINT UQ_SALE_MEDIA_SORT UNIQUE (sale_listing_id, sort_order),
    CONSTRAINT CK_SALE_MEDIA_SORT CHECK (sort_order >= 0)
);
CREATE INDEX IX_SALE_MEDIA_FILE ON PET_SALE_MEDIA (file_id);

CREATE TABLE PET_SALE_INQUIRIES (
    inquiry_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    sale_listing_id NUMBER(19,0) NOT NULL,
    buyer_id NUMBER(19,0) NOT NULL,
    message_private VARCHAR2(4000 BYTE) NOT NULL,
    status VARCHAR2(16 BYTE) DEFAULT 'OPEN' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SALE_INQUIRIES PRIMARY KEY (inquiry_id),
    CONSTRAINT FK_SALE_INQ_LISTING FOREIGN KEY (sale_listing_id) REFERENCES PET_SALE_LISTINGS (sale_listing_id),
    CONSTRAINT FK_SALE_INQ_BUYER FOREIGN KEY (buyer_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_SALE_INQ_STATUS CHECK (status IN ('OPEN','RESPONDED','CLOSED','BLOCKED'))
);
CREATE INDEX IX_SALE_INQ_LISTING ON PET_SALE_INQUIRIES (sale_listing_id, created_at);
CREATE INDEX IX_SALE_INQ_BUYER ON PET_SALE_INQUIRIES (buyer_id, created_at);

-- A completed sale requires buyer/seller confirmations, custody and audit.
-- PETS.owner_user_id must change in the same locked service transaction.
CREATE TABLE PET_SALE_TRANSACTIONS (
    sale_txn_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    sale_listing_id NUMBER(19,0) NOT NULL,
    pet_id NUMBER(19,0) NOT NULL,
    seller_id NUMBER(19,0) NOT NULL,
    buyer_id NUMBER(19,0) NOT NULL,
    agreed_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) NOT NULL,
    handover_state VARCHAR2(20 BYTE) DEFAULT 'PENDING' NOT NULL,
    seller_confirmed_at TIMESTAMP(6) WITH TIME ZONE,
    buyer_confirmed_at TIMESTAMP(6) WITH TIME ZONE,
    completed_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SALE_TRANSACTIONS PRIMARY KEY (sale_txn_id),
    CONSTRAINT FK_SALE_TXN_LISTING FOREIGN KEY (sale_listing_id) REFERENCES PET_SALE_LISTINGS (sale_listing_id),
    CONSTRAINT FK_SALE_TXN_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_SALE_TXN_SELLER FOREIGN KEY (seller_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_SALE_TXN_BUYER FOREIGN KEY (buyer_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_SALE_TXN_LISTING UNIQUE (sale_listing_id),
    CONSTRAINT CK_SALE_TXN_DIFFERENT CHECK (seller_id <> buyer_id),
    CONSTRAINT CK_SALE_TXN_AMOUNT CHECK (agreed_minor >= 0),
    CONSTRAINT CK_SALE_TXN_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$')),
    CONSTRAINT CK_SALE_TXN_STATE CHECK (handover_state IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED','DISPUTED')),
    CONSTRAINT CK_SALE_TXN_COMPLETE CHECK (
      (handover_state = 'COMPLETED' AND completed_at IS NOT NULL AND
       seller_confirmed_at IS NOT NULL AND buyer_confirmed_at IS NOT NULL)
      OR (handover_state <> 'COMPLETED' AND completed_at IS NULL))
);
CREATE INDEX IX_SALE_TXN_PET ON PET_SALE_TRANSACTIONS (pet_id);
CREATE INDEX IX_SALE_TXN_BUYER ON PET_SALE_TRANSACTIONS (buyer_id, created_at);
CREATE INDEX IX_SALE_TXN_SELLER ON PET_SALE_TRANSACTIONS (seller_id);
CREATE OR REPLACE TRIGGER TRG_SALE_LISTINGS_UPD
    BEFORE UPDATE ON PET_SALE_LISTINGS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_SALE_INQ_UPD
    BEFORE UPDATE ON PET_SALE_INQUIRIES FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V006 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V006', 'Approved animal listings and sales', 'ORACLE',
     '6cdd90eb72b20d30cf50e107e88b2de08702bff509f1f907d2fbea56f838c76c');
COMMIT;

PROMPT PawCare | V006 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('PET_SALE_LISTINGS', 'PET_SALE_MEDIA', 'PET_SALE_INQUIRIES', 'PET_SALE_TRANSACTIONS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V006';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 4
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20006, 'V006: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V006: 4 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V006 complete.
