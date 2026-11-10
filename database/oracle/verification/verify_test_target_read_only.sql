-- PawCare Round 13: first connection gate, read-only and safe before V001.
-- Run in SQL*Plus/SQLcl after connecting to an AUTHORIZED disposable test PDB.
-- Never connects, creates, grants, applies migrations or modifies data.
SET ECHO OFF
SET VERIFY OFF
SET FEEDBACK ON
SET SERVEROUTPUT ON
SET LINESIZE 200
SET PAGESIZE 100
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT PawCare Oracle identity preflight - READ ONLY
DECLARE
    v_container VARCHAR2(128) := SYS_CONTEXT('USERENV','CON_NAME');
BEGIN
    IF v_container IS NULL OR UPPER(v_container) IN ('CDB$ROOT', 'PDB$SEED') THEN
        RAISE_APPLICATION_ERROR(-20913,
          'Wrong target: connect to a dedicated TEST PDB, not the root/seed container.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('NON-ROOT PDB CONFIRMED. Compare the PDB name below with your authorized test target.');
END;
/

PROMPT [1] Confirm service/PDB and the current session account
SELECT SYS_CONTEXT('USERENV','DB_NAME') AS database_name,
       SYS_CONTEXT('USERENV','CON_NAME') AS pdb_name,
       SYS_CONTEXT('USERENV','SESSION_USER') AS session_user,
       SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS current_schema
  FROM DUAL;

PROMPT [2] Does PAWCARE_APP already exist in this PDB? (0 = absent, 1 = present)
SELECT COUNT(*) AS pawcare_app_exists
  FROM ALL_USERS
 WHERE USERNAME = 'PAWCARE_APP';

PROMPT [3] Reminder
PROMPT Stop if this PDB contains important data, if PAWCARE_APP already exists unexpectedly,
PROMPT or if any identity differs from the approved test environment.
PROMPT NO database modifications were performed by this preflight.
