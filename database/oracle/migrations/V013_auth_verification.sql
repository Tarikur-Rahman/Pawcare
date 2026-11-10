-- ============================================================================
-- PawCare | Oracle migration V013: email verification tokens
-- Dependencies: V001 through V012; execute in strict numeric order.
-- ============================================================================
SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT PawCare | V013 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001','V002','V003','V004','V005','V006',
                                 'V007','V008','V009','V010','V011','V012');
    IF v_predecessors <> 12 THEN
       RAISE_APPLICATION_ERROR(-20002, 'V013: all earlier migrations are required.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V013';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20002, 'V013 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME = 'EMAIL_VERIFICATION_TOKENS'
       AND OBJECT_TYPE IN ('TABLE','INDEX');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20002, 'V013 target objects exist; inspect partial deployment.');
    END IF;
END;
/

-- BEGIN V013 DDL (checksum scope starts after this line)

CREATE TABLE EMAIL_VERIFICATION_TOKENS (
    token_id    NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id     NUMBER(19,0) NOT NULL,
    token_hash  CHAR(64 BYTE) NOT NULL,
    expires_at  TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP(6) WITH TIME ZONE,
    created_at  TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_EMAIL_VERIFY_TOKENS PRIMARY KEY (token_id),
    CONSTRAINT FK_EMAIL_VERIFY_USER FOREIGN KEY (user_id) REFERENCES USERS(user_id),
    CONSTRAINT UQ_EMAIL_VERIFY_HASH UNIQUE (token_hash),
    CONSTRAINT CK_EMAIL_VERIFY_HASH CHECK (REGEXP_LIKE(token_hash, '^[0-9a-f]{64}$')),
    CONSTRAINT CK_EMAIL_VERIFY_EXPIRY CHECK (expires_at > created_at)
);

CREATE INDEX IX_EMAIL_VERIFY_USER ON EMAIL_VERIFICATION_TOKENS
    (user_id, used_at, expires_at);

-- END V013 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256, applied_at)
VALUES
    ('V013', 'V013_auth_verification.sql', 'ORACLE',
     'eda514f1d6284e7a00897ba4d7ba5f01bbc678163f707a5c2a0a6675f098d5b3',
     SYSTIMESTAMP);

COMMIT;
PROMPT V013 applied.
