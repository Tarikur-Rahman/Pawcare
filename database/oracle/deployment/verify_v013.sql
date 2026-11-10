-- PawCare Oracle V013 post-deployment validation.
-- READ ONLY. Does not modify schema or data.
SET ECHO OFF
SET VERIFY OFF
SET FEEDBACK ON
SET SERVEROUTPUT ON SIZE UNLIMITED
SET LINESIZE 240
SET PAGESIZE 200
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE

DECLARE
    v_ledger NUMBER;
    v_table NUMBER;
    v_columns NUMBER;
    v_constraints NUMBER;
    v_index NUMBER;
    v_index_columns NUMBER;
    v_invalid NUMBER;
    v_position NUMBER;
    v_column_name VARCHAR2(128);
    v_expression VARCHAR2(32767);
    v_expected VARCHAR2(32767);
    v_timestamp_type VARCHAR2(128);
    v_failures NUMBER := 0;

    CURSOR c_index_columns IS
        SELECT ic.column_position, ic.column_name, ie.column_expression
          FROM USER_IND_COLUMNS ic
          LEFT JOIN USER_IND_EXPRESSIONS ie
            ON ie.index_name = ic.index_name
           AND ie.column_position = ic.column_position
         WHERE ic.index_name = 'IX_EMAIL_VERIFY_USER'
           AND ic.table_name = 'EMAIL_VERIFICATION_TOKENS'
         ORDER BY ic.column_position;

    PROCEDURE failure(message VARCHAR2) IS
    BEGIN
        v_failures := v_failures + 1;
        DBMS_OUTPUT.PUT_LINE('FAIL | ' || message);
    END;
BEGIN
    SELECT COUNT(*) INTO v_ledger
      FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V013'
       AND description = 'V013_auth_verification.sql'
       AND provider = 'ORACLE'
       AND checksum_sha256 =
           'eda514f1d6284e7a00897ba4d7ba5f01bbc678163f707a5c2a0a6675f098d5b3';
    IF v_ledger <> 1 THEN
        failure('ledger row missing or has incorrect description/provider/checksum');
    END IF;

    SELECT COUNT(*) INTO v_table
      FROM USER_TABLES WHERE TABLE_NAME = 'EMAIL_VERIFICATION_TOKENS';
    IF v_table <> 1 THEN failure('EMAIL_VERIFICATION_TOKENS table is missing'); END IF;

    SELECT COUNT(*) INTO v_columns
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'EMAIL_VERIFICATION_TOKENS'
       AND COLUMN_NAME IN ('TOKEN_ID','USER_ID','TOKEN_HASH','EXPIRES_AT','USED_AT','CREATED_AT');
    IF v_columns <> 6 THEN failure('expected six V013 columns, actual ' || v_columns); END IF;

    SELECT COUNT(*) INTO v_constraints
      FROM USER_CONSTRAINTS
     WHERE CONSTRAINT_NAME IN ('PK_EMAIL_VERIFY_TOKENS','FK_EMAIL_VERIFY_USER',
                               'UQ_EMAIL_VERIFY_HASH','CK_EMAIL_VERIFY_HASH',
                               'CK_EMAIL_VERIFY_EXPIRY')
       AND STATUS = 'ENABLED'
       AND VALIDATED = 'VALIDATED';
    IF v_constraints <> 5 THEN
        failure('expected five enabled/validated constraints, actual ' || v_constraints);
    END IF;

    SELECT COUNT(*) INTO v_index
      FROM USER_INDEXES
     WHERE INDEX_NAME = 'IX_EMAIL_VERIFY_USER'
       AND TABLE_NAME = 'EMAIL_VERIFICATION_TOKENS'
       AND UNIQUENESS = 'NONUNIQUE'
       AND STATUS = 'VALID'
       AND VISIBILITY = 'VISIBLE'
       AND INDEX_TYPE = 'FUNCTION-BASED NORMAL';
    IF v_index <> 1 THEN
        failure('IX_EMAIL_VERIFY_USER table/uniqueness/status/visibility/type metadata mismatch');
    END IF;

    SELECT COUNT(*) INTO v_index_columns
      FROM USER_IND_COLUMNS
     WHERE INDEX_NAME = 'IX_EMAIL_VERIFY_USER'
       AND TABLE_NAME = 'EMAIL_VERIFICATION_TOKENS';
    IF v_index_columns <> 3 THEN
        failure('expected three index positions, actual ' || v_index_columns);
    END IF;

    SELECT data_type INTO v_timestamp_type
      FROM USER_TAB_COLUMNS
     WHERE table_name = 'EMAIL_VERIFICATION_TOKENS'
       AND column_name = 'USED_AT';
    IF NOT REGEXP_LIKE(v_timestamp_type, '^TIMESTAMP(\([0-9]+\))? WITH TIME ZONE$') THEN
        failure('USED_AT is not TIMESTAMP WITH TIME ZONE: ' || v_timestamp_type);
    END IF;
    SELECT data_type INTO v_timestamp_type
      FROM USER_TAB_COLUMNS
     WHERE table_name = 'EMAIL_VERIFICATION_TOKENS'
       AND column_name = 'EXPIRES_AT';
    IF NOT REGEXP_LIKE(v_timestamp_type, '^TIMESTAMP(\([0-9]+\))? WITH TIME ZONE$') THEN
        failure('EXPIRES_AT is not TIMESTAMP WITH TIME ZONE: ' || v_timestamp_type);
    END IF;

    FOR item IN c_index_columns LOOP
        v_position := item.column_position;
        v_column_name := item.column_name;
        v_expression := item.column_expression;
        IF v_position = 1 THEN
            IF v_column_name <> 'USER_ID' OR v_expression IS NOT NULL THEN
                failure('position 1 expected USER_ID with no expression; actual ' ||
                        v_column_name || '/' || NVL(v_expression, '<null>'));
            END IF;
        ELSIF v_position IN (2, 3) THEN
            v_expected := CASE v_position
                WHEN 2 THEN 'SYS_EXTRACT_UTC("USED_AT")'
                ELSE 'SYS_EXTRACT_UTC("EXPIRES_AT")'
            END;
            IF NOT REGEXP_LIKE(v_column_name, '^SYS_NC[0-9]+\$$') THEN
                failure('position ' || v_position || ' expected generated SYS_NC column; actual ' ||
                        NVL(v_column_name, '<null>'));
            END IF;
            IF v_expression IS NULL OR
               REGEXP_REPLACE(UPPER(v_expression), '[[:space:]]', '') <>
               REGEXP_REPLACE(UPPER(v_expected), '[[:space:]]', '') THEN
                failure('position ' || v_position || ' expected expression ' || v_expected ||
                        '; actual ' || NVL(v_expression, '<null>'));
            END IF;
        ELSE
            failure('unexpected index position ' || v_position || ': ' || v_column_name);
        END IF;
    END LOOP;

    SELECT COUNT(*) INTO v_invalid
      FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_invalid <> 0 THEN
        DBMS_OUTPUT.PUT_LINE('WARN | unrelated invalid objects outside V013: ' || v_invalid);
    END IF;

    IF v_failures <> 0 THEN
        RAISE_APPLICATION_ERROR(-20906,
            'V013 post-deployment validation failed with ' || v_failures || ' issue(s).');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V013 ledger, table, columns, constraints, and exact index metadata verified.');
END;
/

SELECT column_position, column_name, column_expression
  FROM USER_IND_COLUMNS ic
  LEFT JOIN USER_IND_EXPRESSIONS ie
    ON ie.index_name = ic.index_name
   AND ie.column_position = ic.column_position
 WHERE ic.index_name = 'IX_EMAIL_VERIFY_USER'
 ORDER BY column_position;

SELECT COUNT(*) AS verification_token_rows
  FROM EMAIL_VERIFICATION_TOKENS;

PROMPT PASS | V013 validation was read only.
