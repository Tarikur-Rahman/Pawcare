-- Read-only validation for V014. Run after an authorized apply.
SET ECHO OFF
SET VERIFY OFF
SET SERVEROUTPUT ON
SET DEFINE OFF
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE

DECLARE
    v_fails NUMBER := 0;
    PROCEDURE expect_count(p_sql IN VARCHAR2, p_expected IN NUMBER, p_name IN VARCHAR2) IS
        v_actual NUMBER;
    BEGIN
        EXECUTE IMMEDIATE p_sql INTO v_actual;
        IF v_actual <> p_expected THEN
            v_fails := v_fails + 1;
            DBMS_OUTPUT.PUT_LINE('FAIL | ' || p_name || ' expected ' || p_expected || ', got ' || v_actual);
        ELSE
            DBMS_OUTPUT.PUT_LINE('PASS | ' || p_name);
        END IF;
    END;
BEGIN
    IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CON_NAME') <> 'FREEPDB1' THEN
        RAISE_APPLICATION_ERROR(-20914, 'Wrong Oracle schema/PDB.');
    END IF;
    expect_count(q'[SELECT COUNT(*) FROM SCHEMA_MIGRATIONS
        WHERE migration_version='V014' AND provider='ORACLE'
          AND description='V014_password_recovery.sql'
          AND TRIM(checksum_sha256)='dfa3c43895a20e1e4a51e55f406e340b71e84582bfc9abf0f6c7adebc550e6e8']',
        1,'V014 ledger and SHA256');
    expect_count(q'[SELECT COUNT(*) FROM SCHEMA_MIGRATIONS WHERE provider='ORACLE']',14,'14 migrations');
    expect_count(q'[SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME='PASSWORD_RESET_TOKENS']',1,'reset table');
    expect_count(q'[SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='PASSWORD_RESET_TOKENS'
        AND COLUMN_NAME IN ('RESET_ID','USER_ID','TOKEN_HASH','EXPIRES_AT','USED_AT','CREATED_AT')]',6,'six reset columns');
    expect_count(q'[SELECT COUNT(*) FROM USER_CONSTRAINTS WHERE TABLE_NAME='PASSWORD_RESET_TOKENS'
        AND CONSTRAINT_NAME IN ('PK_PASSWORD_RESET','FK_PASSWORD_RESET_USER',
          'UQ_PASSWORD_RESET_HASH','CK_PASSWORD_RESET_HASH','CK_PASSWORD_RESET_EXPIRY')
        AND STATUS='ENABLED' AND VALIDATED='VALIDATED']',5,'five enabled constraints');
    expect_count(q'[SELECT COUNT(*) FROM USER_INDEXES WHERE INDEX_NAME='IX_PWD_RESET_USER'
        AND TABLE_NAME='PASSWORD_RESET_TOKENS' AND STATUS='VALID' AND VISIBILITY='VISIBLE']',1,'reset index');
    expect_count(q'[SELECT COUNT(*) FROM USER_IND_COLUMNS WHERE INDEX_NAME='IX_PWD_RESET_USER'
        AND TABLE_NAME='PASSWORD_RESET_TOKENS']',3,'reset index columns');
    IF v_fails>0 THEN
        RAISE_APPLICATION_ERROR(-20914,'V014 verification failed: ' || v_fails || ' mismatches.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V014 schema is ready.');
END;
/
PROMPT PASS | V014 read-only verification completed.
