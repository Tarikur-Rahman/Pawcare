-- PawCare Oracle rollback / recovery preflight: READ ONLY
-- Path: database/oracle/rollback/preflight_read_only.sql
-- Requires V001 (SCHEMA_MIGRATIONS). Run as PAWCARE_APP, intended PDB.
-- Does not prove that an independent backup exists or can be restored.
SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET SERVEROUTPUT ON
SET LINESIZE 220
SET PAGESIZE 200
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT [1] Oracle session identity (confirm PDB and account)
SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS session_user,
       SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS current_schema,
       SYS_CONTEXT('USERENV','CON_NAME') AS container_name
  FROM DUAL;

PROMPT [2] Migration history — retain this output
SELECT migration_version, description, provider, checksum_sha256, applied_at
  FROM SCHEMA_MIGRATIONS
 ORDER BY migration_version;

PROMPT [3] Existing objects
SELECT object_type, status, COUNT(*) AS object_count
  FROM USER_OBJECTS
 GROUP BY object_type, status
 ORDER BY object_type, status;

PROMPT [4] Constraint state
SELECT constraint_type, status, validated, COUNT(*) AS constraint_count
  FROM USER_CONSTRAINTS
 GROUP BY constraint_type, status, validated
 ORDER BY constraint_type, status, validated;

PROMPT [5] Table storage statistics (NUM_ROWS are optimizer estimates, not exact counts)
SELECT table_name, num_rows, last_analyzed
  FROM USER_TABLES
 ORDER BY table_name;

PROMPT [6] Invalid objects
SELECT object_name, object_type, status
  FROM USER_OBJECTS
 WHERE status <> 'VALID'
 ORDER BY object_type, object_name;

PROMPT Preflight complete. Stop all writers and validate backup/clone separately.
