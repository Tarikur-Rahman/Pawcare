-- ============================================================================
-- PawCare | Oracle migration V008: Lost and found reunification
-- File: database/oracle/migrations/V008_lost_found.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V007.
-- Dependencies: V001 through V007; execute in strict numeric order.
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

PROMPT PawCare | V008 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20008,
           'V008: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007');
    IF v_predecessors <> 7 THEN
       RAISE_APPLICATION_ERROR(-20008,
           'V008: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V008';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20008,
           'V008 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('LOST_FOUND_POSTS', 'LOST_FOUND_MEDIA', 'SIGHTINGS', 'REUNIFICATION_CLAIMS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20008,
           'V008: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V008: preflight passed.');
END;
/

-- BEGIN V008 DDL (checksum scope starts after this line)

-- Public projections expose general_area only: no private contact/coordinates.
CREATE TABLE LOST_FOUND_POSTS (
    post_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    pet_id NUMBER(19,0),
    poster_id NUMBER(19,0) NOT NULL,
    category VARCHAR2(5 BYTE) NOT NULL,
    species VARCHAR2(80 BYTE) NOT NULL,
    description VARCHAR2(4000 BYTE) NOT NULL,
    general_area VARCHAR2(160 BYTE) NOT NULL,
    approximate_radius_km NUMBER(7,2),
    observed_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    status VARCHAR2(16 BYTE) DEFAULT 'DRAFT' NOT NULL,
    reviewed_by_user_id NUMBER(19,0),
    published_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_LOST_FOUND_POSTS PRIMARY KEY (post_id),
    CONSTRAINT FK_LOST_PET FOREIGN KEY (pet_id) REFERENCES PETS (pet_id),
    CONSTRAINT FK_LOST_POSTER FOREIGN KEY (poster_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_LOST_REVIEW FOREIGN KEY (reviewed_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_LOST_CATEGORY CHECK (category IN ('LOST','FOUND')),
    CONSTRAINT CK_LOST_STATUS CHECK (status IN ('DRAFT','OPEN','VERIFYING','REUNITED','CLOSED','REMOVED')),
    CONSTRAINT CK_LOST_RADIUS CHECK (approximate_radius_km IS NULL OR approximate_radius_km > 0),
    CONSTRAINT CK_LOST_PUBLIC CHECK (status <> 'OPEN' OR (reviewed_by_user_id IS NOT NULL AND published_at IS NOT NULL))
);
CREATE INDEX IX_LOST_PUBLIC ON LOST_FOUND_POSTS (status, general_area, created_at);
CREATE INDEX IX_LOST_POSTER ON LOST_FOUND_POSTS (poster_id, created_at);
CREATE INDEX IX_LOST_PET ON LOST_FOUND_POSTS (pet_id);
CREATE INDEX IX_LOST_REVIEW ON LOST_FOUND_POSTS (reviewed_by_user_id);

CREATE TABLE LOST_FOUND_MEDIA (
    lost_media_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    post_id NUMBER(19,0) NOT NULL,
    file_id NUMBER(19,0) NOT NULL,
    sort_order NUMBER(5,0) DEFAULT 0 NOT NULL,
    CONSTRAINT PK_LOST_MEDIA PRIMARY KEY (lost_media_id),
    CONSTRAINT FK_LOST_MEDIA_POST FOREIGN KEY (post_id) REFERENCES LOST_FOUND_POSTS (post_id),
    CONSTRAINT FK_LOST_MEDIA_FILE FOREIGN KEY (file_id) REFERENCES FILE_ASSETS (file_id),
    CONSTRAINT UQ_LOST_MEDIA_FILE UNIQUE (post_id,file_id),
    CONSTRAINT UQ_LOST_MEDIA_SORT UNIQUE (post_id,sort_order),
    CONSTRAINT CK_LOST_MEDIA_SORT CHECK (sort_order >= 0)
);
CREATE INDEX IX_LOST_MEDIA_FILE ON LOST_FOUND_MEDIA (file_id);

CREATE TABLE SIGHTINGS (
    sighting_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    post_id NUMBER(19,0) NOT NULL,
    reporter_id NUMBER(19,0) NOT NULL,
    approximate_area VARCHAR2(160 BYTE) NOT NULL,
    observed_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    description_private VARCHAR2(4000 BYTE),
    evidence_file_id NUMBER(19,0),
    status VARCHAR2(14 BYTE) DEFAULT 'SUBMITTED' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SIGHTINGS PRIMARY KEY (sighting_id),
    CONSTRAINT FK_SIGHT_POST FOREIGN KEY (post_id) REFERENCES LOST_FOUND_POSTS (post_id),
    CONSTRAINT FK_SIGHT_REPORTER FOREIGN KEY (reporter_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_SIGHT_EVIDENCE FOREIGN KEY (evidence_file_id) REFERENCES FILE_ASSETS (file_id),
    CONSTRAINT CK_SIGHT_STATUS CHECK (status IN ('SUBMITTED','REVIEWED','DISMISSED'))
);
CREATE INDEX IX_SIGHT_POST ON SIGHTINGS (post_id, observed_at);
CREATE INDEX IX_SIGHT_REPORTER ON SIGHTINGS (reporter_id);
CREATE INDEX IX_SIGHT_EVIDENCE ON SIGHTINGS (evidence_file_id);

CREATE TABLE REUNIFICATION_CLAIMS (
    claim_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    post_id NUMBER(19,0) NOT NULL,
    claimant_id NUMBER(19,0) NOT NULL,
    proof_asset_id NUMBER(19,0) NOT NULL,
    status VARCHAR2(16 BYTE) DEFAULT 'SUBMITTED' NOT NULL,
    reviewed_by_user_id NUMBER(19,0),
    reviewed_at TIMESTAMP(6) WITH TIME ZONE,
    poster_confirmed_at TIMESTAMP(6) WITH TIME ZONE,
    claimant_confirmed_at TIMESTAMP(6) WITH TIME ZONE,
    resolved_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_REUNIFICATION PRIMARY KEY (claim_id),
    CONSTRAINT FK_REUNION_POST FOREIGN KEY (post_id) REFERENCES LOST_FOUND_POSTS (post_id),
    CONSTRAINT FK_REUNION_CLAIMANT FOREIGN KEY (claimant_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_REUNION_PROOF FOREIGN KEY (proof_asset_id) REFERENCES FILE_ASSETS (file_id),
    CONSTRAINT FK_REUNION_REVIEWER FOREIGN KEY (reviewed_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_REUNION_STATUS CHECK (status IN ('SUBMITTED','VERIFYING','VERIFIED','REUNITED','REJECTED','WITHDRAWN')),
    CONSTRAINT CK_REUNION_RESOLVED CHECK ((status='REUNITED' AND resolved_at IS NOT NULL
      AND poster_confirmed_at IS NOT NULL AND claimant_confirmed_at IS NOT NULL
      AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
      OR (status <> 'REUNITED' AND resolved_at IS NULL))
);
CREATE UNIQUE INDEX UX_REUNION_ACTIVE ON REUNIFICATION_CLAIMS (
  CASE WHEN status IN ('SUBMITTED','VERIFYING','VERIFIED') THEN post_id END,
  CASE WHEN status IN ('SUBMITTED','VERIFYING','VERIFIED') THEN claimant_id END
);
-- Only one completed reunion per report; proof and both confirmations required.
CREATE UNIQUE INDEX UX_REUNION_FINAL ON REUNIFICATION_CLAIMS (
  CASE WHEN status='REUNITED' THEN post_id END
);
CREATE INDEX IX_REUNION_POST ON REUNIFICATION_CLAIMS (post_id, status);
CREATE INDEX IX_REUNION_USER ON REUNIFICATION_CLAIMS (claimant_id);
CREATE INDEX IX_REUNION_PROOF ON REUNIFICATION_CLAIMS (proof_asset_id);
CREATE INDEX IX_REUNION_REVIEWER ON REUNIFICATION_CLAIMS (reviewed_by_user_id);
CREATE OR REPLACE TRIGGER TRG_LOST_POSTS_UPD
    BEFORE UPDATE ON LOST_FOUND_POSTS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V008 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V008', 'Lost and found reunification', 'ORACLE',
     '99704d954414bac6b6d181cc102d8b25a61176e2a13373b002de35fc9c9b0d85');
COMMIT;

PROMPT PawCare | V008 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('LOST_FOUND_POSTS', 'LOST_FOUND_MEDIA', 'SIGHTINGS', 'REUNIFICATION_CLAIMS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V008';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 4
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20008, 'V008: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V008: 4 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V008 complete.
