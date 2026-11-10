-- ============================================================================
-- PawCare | Oracle migration V007: Moderation and favorites
-- File: database/oracle/migrations/V007_moderation_favorites.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V006.
-- Dependencies: V001 through V006; execute in strict numeric order.
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

PROMPT PawCare | V007 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20007,
           'V007: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004', 'V005', 'V006');
    IF v_predecessors <> 6 THEN
       RAISE_APPLICATION_ERROR(-20007,
           'V007: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V007';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20007,
           'V007 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('LISTING_REPORTS', 'MODERATION_ACTIONS', 'FAVORITES')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20007,
           'V007: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V007: preflight passed.');
END;
/

-- BEGIN V007 DDL (checksum scope starts after this line)

-- Moderation targets are polymorphic. FK target existence and visibility
-- MUST be enforced in the API, including future V008/V009 target types.
CREATE TABLE LISTING_REPORTS (
    report_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    reporter_id NUMBER(19,0) NOT NULL,
    listing_type VARCHAR2(20 BYTE) NOT NULL,
    listing_id NUMBER(19,0) NOT NULL,
    reason_code VARCHAR2(40 BYTE) NOT NULL,
    details_private VARCHAR2(4000 BYTE),
    review_state VARCHAR2(16 BYTE) DEFAULT 'OPEN' NOT NULL,
    assigned_reviewer_id NUMBER(19,0),
    resolved_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_LISTING_REPORTS PRIMARY KEY (report_id),
    CONSTRAINT FK_REPORT_USER FOREIGN KEY (reporter_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_REPORT_REVIEWER FOREIGN KEY (assigned_reviewer_id) REFERENCES USERS (user_id),
    CONSTRAINT CK_REPORT_TYPE CHECK (listing_type IN ('ADOPTION','PET_SALE','LOST_FOUND','FOOD_PRODUCT','DONATION')),
    CONSTRAINT CK_REPORT_REASON CHECK (reason_code IN ('FRAUD','ABUSE','ILLEGAL','PRIVACY','SPAM','MISLEADING','OTHER')),
    CONSTRAINT CK_REPORT_STATE CHECK (review_state IN ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')),
    CONSTRAINT CK_REPORT_RESOLVED CHECK ((review_state IN ('RESOLVED','DISMISSED') AND resolved_at IS NOT NULL)
        OR (review_state IN ('OPEN','IN_REVIEW') AND resolved_at IS NULL))
);
CREATE INDEX IX_REPORT_REVIEW ON LISTING_REPORTS (review_state, created_at);
CREATE INDEX IX_REPORT_TARGET ON LISTING_REPORTS (listing_type, listing_id);
CREATE INDEX IX_REPORT_USER ON LISTING_REPORTS (reporter_id);
CREATE INDEX IX_REPORT_ASSIGNEE ON LISTING_REPORTS (assigned_reviewer_id);

CREATE TABLE MODERATION_ACTIONS (
    moderation_action_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    actor_user_id NUMBER(19,0) NOT NULL,
    report_id NUMBER(19,0),
    entity_type VARCHAR2(20 BYTE) NOT NULL,
    entity_id NUMBER(19,0) NOT NULL,
    action_code VARCHAR2(24 BYTE) NOT NULL,
    reason_code VARCHAR2(80 BYTE) NOT NULL,
    private_note VARCHAR2(2000 BYTE),
    happened_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_MOD_ACTIONS PRIMARY KEY (moderation_action_id),
    CONSTRAINT FK_MOD_ACTOR FOREIGN KEY (actor_user_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_MOD_REPORT FOREIGN KEY (report_id) REFERENCES LISTING_REPORTS (report_id),
    CONSTRAINT CK_MOD_ENTITY CHECK (entity_type IN ('ADOPTION','PET_SALE','LOST_FOUND','FOOD_PRODUCT','DONATION','USER')),
    CONSTRAINT CK_MOD_ACTION CHECK (action_code IN ('APPROVE','REJECT','HOLD','REMOVE','REINSTATE','APPEAL_UPHELD','APPEAL_DENIED'))
);
CREATE INDEX IX_MOD_ACTION_ENTITY ON MODERATION_ACTIONS (entity_type, entity_id, happened_at);
CREATE INDEX IX_MOD_ACTOR ON MODERATION_ACTIONS (actor_user_id, happened_at);
CREATE INDEX IX_MOD_REPORT ON MODERATION_ACTIONS (report_id);

CREATE TABLE FAVORITES (
    favorite_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    entity_type VARCHAR2(20 BYTE) NOT NULL,
    entity_id NUMBER(19,0) NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_FAVORITES PRIMARY KEY (favorite_id),
    CONSTRAINT FK_FAV_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_FAV_TARGET UNIQUE (user_id, entity_type, entity_id),
    CONSTRAINT CK_FAV_TYPE CHECK (entity_type IN ('ADOPTION','PET_SALE','LOST_FOUND','FOOD_PRODUCT'))
);
CREATE INDEX IX_FAV_TARGET ON FAVORITES (entity_type, entity_id);


-- END V007 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V007', 'Moderation and favorites', 'ORACLE',
     'dec968b0b293c3d3fbd109a17cd72ef8719c81d1a03a7577afc6c5d2628e365f');
COMMIT;

PROMPT PawCare | V007 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('LISTING_REPORTS', 'MODERATION_ACTIONS', 'FAVORITES');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V007';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 3
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20007, 'V007: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V007: 3 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V007 complete.
