-- ============================================================================
-- PawCare | Oracle migration V004: Adoption listings and handovers
-- File: database/oracle/migrations/V004_adoption.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V003.
-- Dependencies: V001 through V003; execute in strict numeric order.
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

PROMPT PawCare | V004 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20004,
           'V004: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003');
    IF v_predecessors <> 3 THEN
       RAISE_APPLICATION_ERROR(-20004,
           'V004: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V004';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20004,
           'V004 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('ADOPTION_LISTINGS', 'ADOPTION_MEDIA', 'ADOPTION_APPLICATIONS', 'ADOPTION_HANDOVERS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20004,
           'V004: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V004: preflight passed.');
END;
/

-- BEGIN V004 DDL (checksum scope starts after this line)

-- Drafts are private; public API projects only moderator-approved PUBLISHED rows.
CREATE TABLE ADOPTION_LISTINGS (
    adoption_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    pet_id NUMBER(19,0),
    creator_id NUMBER(19,0) NOT NULL,
    title VARCHAR2(180 BYTE) NOT NULL,
    description VARCHAR2(4000 BYTE) NOT NULL,
    species VARCHAR2(80 BYTE) NOT NULL,
    general_area VARCHAR2(160 BYTE) NOT NULL,
    status VARCHAR2(20 BYTE) DEFAULT 'DRAFT' NOT NULL,
    reviewed_by_user_id NUMBER(19,0),
    reviewed_at TIMESTAMP(6) WITH TIME ZONE,
    posted_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_ADOPTION_LISTINGS PRIMARY KEY (adoption_id),
    CONSTRAINT FK_ADOPT_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_ADOPT_CREATOR FOREIGN KEY (creator_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_ADOPT_REVIEWER FOREIGN KEY (reviewed_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_ADOPT_STATUS CHECK (status IN (
        'DRAFT','PENDING_REVIEW','PUBLISHED','MATCHED','COMPLETED','REJECTED','WITHDRAWN')),
    CONSTRAINT CK_ADOPT_PUBLISHED CHECK (status <> 'PUBLISHED' OR
        (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND posted_at IS NOT NULL))
);
CREATE INDEX IX_ADOPT_PUBLIC ON ADOPTION_LISTINGS (status, posted_at);
CREATE INDEX IX_ADOPT_CREATOR ON ADOPTION_LISTINGS (creator_id, created_at);
CREATE INDEX IX_ADOPT_PET ON ADOPTION_LISTINGS (pet_id, status);
-- At most one open adoption campaign per known pet in this subsystem.
CREATE UNIQUE INDEX UX_ADOPT_OPEN_PET ON ADOPTION_LISTINGS (
    CASE WHEN status IN ('DRAFT','PENDING_REVIEW','PUBLISHED','MATCHED') THEN pet_id END
);
CREATE INDEX IX_ADOPT_REVIEWER ON ADOPTION_LISTINGS (reviewed_by_user_id);

CREATE TABLE ADOPTION_MEDIA (
    adoption_media_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    adoption_id NUMBER(19,0) NOT NULL,
    file_id NUMBER(19,0) NOT NULL,
    sort_order NUMBER(5,0) DEFAULT 0 NOT NULL,
    CONSTRAINT PK_ADOPTION_MEDIA PRIMARY KEY (adoption_media_id),
    CONSTRAINT FK_ADOPT_MEDIA_LISTING FOREIGN KEY (adoption_id) REFERENCES ADOPTION_LISTINGS (adoption_id),
    CONSTRAINT FK_ADOPT_MEDIA_FILE FOREIGN KEY (file_id) REFERENCES FILE_ASSETS (file_id),
    CONSTRAINT UQ_ADOPT_MEDIA_FILE UNIQUE (adoption_id, file_id),
    CONSTRAINT UQ_ADOPT_MEDIA_SORT UNIQUE (adoption_id, sort_order),
    CONSTRAINT CK_ADOPT_MEDIA_SORT CHECK (sort_order >= 0)
);
CREATE INDEX IX_ADOPT_MEDIA_FILE ON ADOPTION_MEDIA (file_id);

-- Applicant answers may include sensitive personal context: never public.
CREATE TABLE ADOPTION_APPLICATIONS (
    application_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    adoption_id NUMBER(19,0) NOT NULL,
    applicant_id NUMBER(19,0) NOT NULL,
    answers_private CLOB,
    status VARCHAR2(18 BYTE) DEFAULT 'SUBMITTED' NOT NULL,
    submitted_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    reviewed_by_user_id NUMBER(19,0),
    reviewed_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_ADOPTION_APPS PRIMARY KEY (application_id),
    CONSTRAINT FK_ADOPT_APP_LISTING FOREIGN KEY (adoption_id) REFERENCES ADOPTION_LISTINGS (adoption_id),
    CONSTRAINT FK_ADOPT_APP_USER FOREIGN KEY (applicant_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_ADOPT_APP_REVIEW FOREIGN KEY (reviewed_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_ADOPT_APP_STATUS CHECK (status IN ('SUBMITTED','IN_REVIEW','ACCEPTED','REJECTED','WITHDRAWN'))
);
CREATE UNIQUE INDEX UX_ADOPT_APP_ACTIVE ON ADOPTION_APPLICATIONS (
    CASE WHEN status IN ('SUBMITTED','IN_REVIEW','ACCEPTED') THEN adoption_id END,
    CASE WHEN status IN ('SUBMITTED','IN_REVIEW','ACCEPTED') THEN applicant_id END
);
-- Enables a composite handover FK: application belongs to this listing/adopter.
ALTER TABLE ADOPTION_APPLICATIONS ADD CONSTRAINT UQ_ADOPT_APP_TRIPLET
    UNIQUE (adoption_id, application_id, applicant_id);
CREATE INDEX IX_ADOPT_APP_USER ON ADOPTION_APPLICATIONS (applicant_id, submitted_at);
CREATE INDEX IX_ADOPT_APP_REVIEWER ON ADOPTION_APPLICATIONS (reviewed_by_user_id);

-- Application must transfer PETS ownership + handover + audit in one transaction.
-- For external rescue animal, create/link PETS before final confirmation.
CREATE TABLE ADOPTION_HANDOVERS (
    handover_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    adoption_id NUMBER(19,0) NOT NULL,
    application_id NUMBER(19,0) NOT NULL,
    pet_id NUMBER(19,0) NOT NULL,
    prior_owner_id NUMBER(19,0) NOT NULL,
    new_owner_id NUMBER(19,0) NOT NULL,
    owner_confirmed_at TIMESTAMP(6) WITH TIME ZONE,
    adopter_confirmed_at TIMESTAMP(6) WITH TIME ZONE,
    confirmed_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_ADOPT_HANDOVERS PRIMARY KEY (handover_id),
    CONSTRAINT FK_HANDOVER_LISTING FOREIGN KEY (adoption_id) REFERENCES ADOPTION_LISTINGS (adoption_id),
    CONSTRAINT FK_HANDOVER_APP FOREIGN KEY (application_id) REFERENCES ADOPTION_APPLICATIONS (application_id),
    CONSTRAINT FK_HANDOVER_APP_MATCH FOREIGN KEY (adoption_id,application_id,new_owner_id)
       REFERENCES ADOPTION_APPLICATIONS (adoption_id,application_id,applicant_id),
    CONSTRAINT FK_HANDOVER_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_HANDOVER_PRIOR FOREIGN KEY (prior_owner_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_HANDOVER_NEW FOREIGN KEY (new_owner_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_HANDOVER_LISTING UNIQUE (adoption_id),
    CONSTRAINT UQ_HANDOVER_APP UNIQUE (application_id),
    CONSTRAINT CK_HANDOVER_DIFFERENT CHECK (prior_owner_id <> new_owner_id),
    CONSTRAINT CK_HANDOVER_CONFIRM CHECK (confirmed_at IS NULL OR
      (owner_confirmed_at IS NOT NULL AND adopter_confirmed_at IS NOT NULL))
);
CREATE INDEX IX_HANDOVER_PET ON ADOPTION_HANDOVERS (pet_id);
CREATE INDEX IX_HANDOVER_PRIOR ON ADOPTION_HANDOVERS (prior_owner_id);
CREATE INDEX IX_HANDOVER_NEW ON ADOPTION_HANDOVERS (new_owner_id);
CREATE OR REPLACE TRIGGER TRG_ADOPTION_UPD
    BEFORE UPDATE ON ADOPTION_LISTINGS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V004 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V004', 'Adoption listings and handovers', 'ORACLE',
     '4d31b937e7784b1e934dfa125b949c9b1d133b430101f668914c67d3bcf5fd33');
COMMIT;

PROMPT PawCare | V004 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('ADOPTION_LISTINGS', 'ADOPTION_MEDIA', 'ADOPTION_APPLICATIONS', 'ADOPTION_HANDOVERS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V004';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 4
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20004, 'V004: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V004: 4 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V004 complete.
