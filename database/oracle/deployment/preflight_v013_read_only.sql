-- PawCare Oracle V013 deployment preflight.
-- READ ONLY. Run after privately connecting to PAWCARE_APP/FREEPDB1.
SET ECHO OFF
SET VERIFY OFF
SET FEEDBACK ON
SET HEADING ON
SET SERVEROUTPUT ON
SET LINESIZE 240
SET PAGESIZE 200
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT PawCare | V013 read-only preflight

DECLARE
    v_session_user VARCHAR2(128);
    v_current_schema VARCHAR2(128);
    v_container VARCHAR2(128);
    v_oracle_ledger_rows NUMBER;
    v_matching_predecessors NUMBER;
    v_distinct_predecessors NUMBER;
    v_v013_rows NUMBER;
    v_users_table NUMBER;
    v_users_id NUMBER;
    v_conflicts NUMBER;
    v_constraint_conflicts NUMBER;
BEGIN
    v_session_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    v_current_schema := SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA');
    v_container := SYS_CONTEXT('USERENV', 'CON_NAME');
    IF v_session_user <> 'PAWCARE_APP'
       OR v_current_schema <> 'PAWCARE_APP'
       OR v_container <> 'FREEPDB1' THEN
        RAISE_APPLICATION_ERROR(-20901,
            'V013 preflight identity mismatch; expected PAWCARE_APP/PAWCARE_APP/FREEPDB1.');
    END IF;

    SELECT COUNT(*), COUNT(DISTINCT migration_version)
      INTO v_oracle_ledger_rows, v_distinct_predecessors
      FROM SCHEMA_MIGRATIONS
     WHERE provider = 'ORACLE';
    SELECT COUNT(*) INTO v_matching_predecessors
      FROM SCHEMA_MIGRATIONS m
      JOIN (
          SELECT 'V001' migration_version, 'fef2db2ea4e267789fda1d6307d2ac87d98156355b16d190bd602e10d62b15e1' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V002', '7dd3cf6be4820d1cc27271840c1712e5a45897163ded0ae95480f96519bbea46' FROM DUAL
          UNION ALL SELECT 'V003', '26729665ff7d57bbe61a9bf590fc5e144e653d2a469abc55c22a62572bd24d0e' FROM DUAL
          UNION ALL SELECT 'V004', '4d31b937e7784b1e934dfa125b949c9b1d133b430101f668914c67d3bcf5fd33' FROM DUAL
          UNION ALL SELECT 'V005', '3355a2d2b3780622ff300dfb1d280d374d96f037fe7d9908d258ae3bddc7a165' FROM DUAL
          UNION ALL SELECT 'V006', '6cdd90eb72b20d30cf50e107e88b2de08702bff509f1f907d2fbea56f838c76c' FROM DUAL
          UNION ALL SELECT 'V007', 'dec968b0b293c3d3fbd109a17cd72ef8719c81d1a03a7577afc6c5d2628e365f' FROM DUAL
          UNION ALL SELECT 'V008', '99704d954414bac6b6d181cc102d8b25a61176e2a13373b002de35fc9c9b0d85' FROM DUAL
          UNION ALL SELECT 'V009', '116016b508212beb231ad986ad688cef7b980851193d0c61c747321ef0c00f4a' FROM DUAL
          UNION ALL SELECT 'V010', '3a26977be546b113b575e950147954f618b29a10843c48ec770580aeabf492e9' FROM DUAL
          UNION ALL SELECT 'V011', '5d999b53639aead0322b657f42190829924022280ea8e82a5f52cfa4da2d82e1' FROM DUAL
          UNION ALL SELECT 'V012', 'cd28feb4529e134d6bfe9072e9be1af2250d1ab98784b6bab4180940b2de1507' FROM DUAL
      ) expected
        ON expected.migration_version = m.migration_version
       AND expected.checksum_sha256 = TRIM(m.checksum_sha256)
     WHERE m.provider = 'ORACLE';
    SELECT COUNT(*) INTO v_v013_rows
      FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V013';
    IF v_oracle_ledger_rows <> 12
       OR v_distinct_predecessors <> 12
       OR v_matching_predecessors <> 12
       OR v_v013_rows <> 0 THEN
        RAISE_APPLICATION_ERROR(-20902,
            'V013 requires exactly V001-V012 with immutable checksums and no V013 row.');
    END IF;

    SELECT COUNT(*) INTO v_users_table
      FROM USER_TABLES WHERE TABLE_NAME = 'USERS';
    SELECT COUNT(*) INTO v_users_id
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'USERS' AND COLUMN_NAME = 'USER_ID';
    IF v_users_table <> 1 OR v_users_id <> 1 THEN
        RAISE_APPLICATION_ERROR(-20903,
            'V013 dependency USERS(USER_ID) is missing.');
    END IF;

    SELECT COUNT(*) INTO v_conflicts
      FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('EMAIL_VERIFICATION_TOKENS', 'IX_EMAIL_VERIFY_USER',
                           'PK_EMAIL_VERIFY_TOKENS', 'FK_EMAIL_VERIFY_USER',
                           'UQ_EMAIL_VERIFY_HASH', 'CK_EMAIL_VERIFY_HASH',
                           'CK_EMAIL_VERIFY_EXPIRY');
    SELECT COUNT(*) INTO v_constraint_conflicts
      FROM USER_CONSTRAINTS
     WHERE CONSTRAINT_NAME IN ('PK_EMAIL_VERIFY_TOKENS', 'FK_EMAIL_VERIFY_USER',
                               'UQ_EMAIL_VERIFY_HASH', 'CK_EMAIL_VERIFY_HASH',
                               'CK_EMAIL_VERIFY_EXPIRY');
    IF v_conflicts <> 0 OR v_constraint_conflicts <> 0 THEN
        RAISE_APPLICATION_ERROR(-20904,
            'V013 target object or constraint names already exist; inspect partial deployment.');
    END IF;

    DBMS_OUTPUT.PUT_LINE(
        'PASS | identity, exact V001-V012 ledger, USERS(USER_ID), and V013 names verified.'
    );
END;
/

SELECT migration_version, provider, TRIM(checksum_sha256) AS checksum_sha256
  FROM SCHEMA_MIGRATIONS
 WHERE provider = 'ORACLE'
 ORDER BY migration_version;

SELECT table_name, column_name, data_type, data_length, data_precision, data_scale
  FROM USER_TAB_COLUMNS
 WHERE table_name = 'USERS' AND column_name = 'USER_ID';

PROMPT PASS | No database modifications were performed.
