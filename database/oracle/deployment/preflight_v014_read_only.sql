-- Read-only V014 preflight. Must be run as PAWCARE_APP in FREEPDB1.
SET ECHO OFF
SET VERIFY OFF
SET SERVEROUTPUT ON
SET DEFINE OFF
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE

DECLARE
    v_actual NUMBER;
    v_matches NUMBER;
    v_v014 NUMBER;
    v_dependencies NUMBER;
    v_conflicts NUMBER;
    v_constraints NUMBER;
BEGIN
    IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CON_NAME') <> 'FREEPDB1' THEN
        RAISE_APPLICATION_ERROR(-20914,'Wrong database identity: expected PAWCARE_APP/FREEPDB1.');
    END IF;
    SELECT COUNT(*) INTO v_actual FROM SCHEMA_MIGRATIONS WHERE provider='ORACLE';
    SELECT COUNT(*) INTO v_matches
      FROM SCHEMA_MIGRATIONS m JOIN (
          SELECT 'V001' migration_version, 'fef2db2ea4e267789fda1d6307d2ac87d98156355b16d190bd602e10d62b15e1' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V002' migration_version, '7dd3cf6be4820d1cc27271840c1712e5a45897163ded0ae95480f96519bbea46' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V003' migration_version, '26729665ff7d57bbe61a9bf590fc5e144e653d2a469abc55c22a62572bd24d0e' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V004' migration_version, '4d31b937e7784b1e934dfa125b949c9b1d133b430101f668914c67d3bcf5fd33' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V005' migration_version, '3355a2d2b3780622ff300dfb1d280d374d96f037fe7d9908d258ae3bddc7a165' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V006' migration_version, '6cdd90eb72b20d30cf50e107e88b2de08702bff509f1f907d2fbea56f838c76c' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V007' migration_version, 'dec968b0b293c3d3fbd109a17cd72ef8719c81d1a03a7577afc6c5d2628e365f' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V008' migration_version, '99704d954414bac6b6d181cc102d8b25a61176e2a13373b002de35fc9c9b0d85' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V009' migration_version, '116016b508212beb231ad986ad688cef7b980851193d0c61c747321ef0c00f4a' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V010' migration_version, '3a26977be546b113b575e950147954f618b29a10843c48ec770580aeabf492e9' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V011' migration_version, '5d999b53639aead0322b657f42190829924022280ea8e82a5f52cfa4da2d82e1' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V012' migration_version, 'cd28feb4529e134d6bfe9072e9be1af2250d1ab98784b6bab4180940b2de1507' checksum_sha256 FROM DUAL
          UNION ALL SELECT 'V013' migration_version, 'eda514f1d6284e7a00897ba4d7ba5f01bbc678163f707a5c2a0a6675f098d5b3' checksum_sha256 FROM DUAL
      ) expected ON m.migration_version=expected.migration_version
       AND TRIM(m.checksum_sha256)=expected.checksum_sha256
       AND m.provider='ORACLE';
    SELECT COUNT(*) INTO v_v014 FROM SCHEMA_MIGRATIONS WHERE migration_version='V014';
    IF v_actual<>13 OR v_matches<>13 OR v_v014<>0 THEN
        RAISE_APPLICATION_ERROR(-20914,'Migration ledger must exactly match V001-V013; V014 must not exist.');
    END IF;
    SELECT COUNT(*) INTO v_dependencies FROM USER_TABLES
        WHERE TABLE_NAME IN ('USERS','SESSIONS','EMAIL_VERIFICATION_TOKENS');
    IF v_dependencies<>3 THEN
        RAISE_APPLICATION_ERROR(-20914,'V014 dependency tables missing.');
    END IF;
    SELECT COUNT(*) INTO v_conflicts FROM USER_OBJECTS WHERE OBJECT_NAME IN
        ('PASSWORD_RESET_TOKENS','IX_PWD_RESET_USER','PK_PASSWORD_RESET',
         'FK_PASSWORD_RESET_USER','UQ_PASSWORD_RESET_HASH',
         'CK_PASSWORD_RESET_HASH','CK_PASSWORD_RESET_EXPIRY');
    SELECT COUNT(*) INTO v_constraints FROM USER_CONSTRAINTS WHERE CONSTRAINT_NAME IN
        ('PK_PASSWORD_RESET','FK_PASSWORD_RESET_USER','UQ_PASSWORD_RESET_HASH',
         'CK_PASSWORD_RESET_HASH','CK_PASSWORD_RESET_EXPIRY');
    IF v_conflicts<>0 OR v_constraints<>0 THEN
        RAISE_APPLICATION_ERROR(-20914,'V014 object names exist; inspect partial migration.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V014 preflight. Exact V001-V013 checksums, schema identity and dependencies verified.');
END;
/
SELECT migration_version,provider,TRIM(checksum_sha256) checksum_sha256
 FROM SCHEMA_MIGRATIONS ORDER BY migration_version;
PROMPT PASS | No schema or data modified.
