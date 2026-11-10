-- PawCare Oracle post-recovery inventory: READ ONLY
-- Path: database/oracle/rollback/verify_after_recovery.sql
-- Tolerant of a state before V001; migration history only if ledger exists.
SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET SERVEROUTPUT ON
SET LINESIZE 220
SET PAGESIZE 200
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT [1] Verify connected schema/PDB
SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS session_user,
       SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS current_schema,
       SYS_CONTEXT('USERENV','CON_NAME') AS container_name
  FROM DUAL;

PROMPT [2] Object counts
SELECT object_type, status, COUNT(*) AS object_count
  FROM USER_OBJECTS
 GROUP BY object_type, status
 ORDER BY object_type, status;

PROMPT [3] Disabled/unvalidated constraints (investigate all rows)
SELECT constraint_name, table_name, constraint_type, status, validated
  FROM USER_CONSTRAINTS
 WHERE status <> 'ENABLED' OR validated <> 'VALIDATED'
 ORDER BY table_name, constraint_name;

PROMPT [4] Invalid objects (investigate all rows)
SELECT object_name, object_type, status
  FROM USER_OBJECTS
 WHERE status <> 'VALID'
 ORDER BY object_type, object_name;

PROMPT [5] Migration ledger (if present)
DECLARE
    v_exists NUMBER;
    v_count NUMBER;
    v_latest VARCHAR2(32);
BEGIN
    SELECT COUNT(*) INTO v_exists FROM USER_TABLES
      WHERE TABLE_NAME='SCHEMA_MIGRATIONS';
    IF v_exists=0 THEN
        DBMS_OUTPUT.PUT_LINE('SCHEMA_MIGRATIONS missing (pre-V001 or incomplete).');
    ELSE
        EXECUTE IMMEDIATE
            'SELECT COUNT(*), MAX(migration_version) FROM SCHEMA_MIGRATIONS'
            INTO v_count, v_latest;
        DBMS_OUTPUT.PUT_LINE('Applied ledger entries: ' || TO_CHAR(v_count));
        DBMS_OUTPUT.PUT_LINE('Latest ledger version: ' || NVL(v_latest,'(none)'));
    END IF;
END;
/

PROMPT Post-recovery inventory complete. Compare with approved target version,
PROMPT backups, row-level reconciliation and live application acceptance tests.
