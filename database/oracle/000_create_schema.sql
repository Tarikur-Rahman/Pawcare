-- ============================================================================
-- PawCare | Oracle database bootstrap
-- File: database/oracle/000_create_schema.sql
-- Purpose: Provision the application schema before V001_core_care.sql.
-- Target: Oracle Database 19c+ / Oracle Database Free (connect to a PDB).
-- Tool: SQL*Plus or SQLcl (interactive script; SQL Developer F5 may also work).
--
-- Run as a database administrator with CREATE USER, privilege-grant, and
-- tablespace dictionary access in the TARGET PDB, not as PAWCARE_APP.
--
-- Prerequisites:
--   * Target PDB/service selected (e.g., FREEPDB1), NOT CDB$ROOT.
--   * USERS (permanent) and TEMP (temporary) tablespaces exist.
--   * A dedicated, strong password chosen; do not place it in this file.
--
-- Safety:
--   * Preflight aborts if PAWCARE_APP already exists.
--   * No DROP, TRUNCATE, or destructive re-creation.
--   * No broad DBA / ANY / UNLIMITED TABLESPACE privileges.
--   * Oracle DDL auto-commits: a later grant failure can leave the user
--     created. Review the state with an administrator before retrying.
--   * Run once per environment; do not run during normal API startup.
--
-- Scope boundary:
--   * Creates the Oracle account/schema and minimal schema-owner privileges.
--   * Does NOT create PawCare's tables, migration ledger, seed data, or
--     an API runtime-only account. Those belong to later migrations/setup.
-- ============================================================================

SET ECHO OFF
SET VERIFY OFF
SET FEEDBACK ON
SET SERVEROUTPUT ON
SET DEFINE ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT ============================================================
PROMPT PawCare / Oracle schema initialization
PROMPT Target schema: PAWCARE_APP
PROMPT Storage quota: 500 MB on USERS
PROMPT ============================================================

-- 1) Fail early for an inappropriate container, missing tablespaces,
--    or an existing PawCare schema. No changes happen in this block.
DECLARE
    v_count NUMBER;
    v_container VARCHAR2(128);
BEGIN
    v_container := SYS_CONTEXT('USERENV', 'CON_NAME');

    IF UPPER(NVL(v_container, 'UNKNOWN')) = 'CDB$ROOT' THEN
        RAISE_APPLICATION_ERROR(
            -20001,
            'Connect to the intended pluggable database (PDB), not CDB$ROOT.'
        );
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM ALL_USERS
     WHERE USERNAME = 'PAWCARE_APP';

    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(
            -20002,
            'PAWCARE_APP already exists; this bootstrap will not modify it.'
        );
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM DBA_TABLESPACES
     WHERE TABLESPACE_NAME = 'USERS'
       AND CONTENTS = 'PERMANENT';

    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(
            -20003,
            'Permanent tablespace USERS not found; ask your DBA to adapt this script.'
        );
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM DBA_TABLESPACES
     WHERE TABLESPACE_NAME = 'TEMP'
       AND CONTENTS = 'TEMPORARY';

    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(
            -20004,
            'Temporary tablespace TEMP not found; ask your DBA to adapt this script.'
        );
    END IF;

    DBMS_OUTPUT.PUT_LINE('Preflight passed. Container: ' || NVL(v_container, '(non-CDB)'));
END;
/

-- 2) Prompt securely for the schema-owner password.
--    SQL*Plus/SQLcl HIDE suppresses typed characters; VERIFY/ECHO remain off.
--    Avoid a double-quote character in the password for this SQL*Plus script.
ACCEPT PAWCARE_PASSWORD CHAR PROMPT 'Enter a NEW strong PAWCARE_APP password: ' HIDE

-- 3) Oracle user == Oracle schema. Deliberately use a fixed schema name.
--    A bounded quota avoids giving the account unlimited tablespace access.
CREATE USER PAWCARE_APP
    IDENTIFIED BY "&PAWCARE_PASSWORD"
    DEFAULT TABLESPACE USERS
    TEMPORARY TABLESPACE TEMP
    QUOTA 500M ON USERS
    ACCOUNT UNLOCK;

-- Remove the SQL*Plus password substitution variable immediately after use.
UNDEFINE PAWCARE_PASSWORD

-- 4) Schema-owner privileges for future versioned SQL migrations.
--    CREATE SESSION is required to log in. These do not confer DBA privileges.
GRANT CREATE SESSION,
      CREATE TABLE,
      CREATE SEQUENCE,
      CREATE VIEW,
      CREATE PROCEDURE,
      CREATE TRIGGER
  TO PAWCARE_APP;

-- 5) Verify what was actually provisioned. No secret is printed.
PROMPT
PROMPT --- Schema account ---
SELECT USERNAME, ACCOUNT_STATUS, DEFAULT_TABLESPACE, TEMPORARY_TABLESPACE
  FROM DBA_USERS
 WHERE USERNAME = 'PAWCARE_APP';

PROMPT
PROMPT --- Granted system privileges ---
SELECT PRIVILEGE
  FROM DBA_SYS_PRIVS
 WHERE GRANTEE = 'PAWCARE_APP'
 ORDER BY PRIVILEGE;

PROMPT
PROMPT --- Tablespace quota (bytes) ---
SELECT TABLESPACE_NAME, MAX_BYTES
  FROM DBA_TS_QUOTAS
 WHERE USERNAME = 'PAWCARE_APP'
 ORDER BY TABLESPACE_NAME;

PROMPT
PROMPT PawCare schema bootstrap completed.
PROMPT Next: connect as PAWCARE_APP and execute oracle/migrations/V001_core_care.sql
PROMPT (after that migration is implemented and reviewed).
