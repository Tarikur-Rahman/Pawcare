-- ============================================================================
-- PawCare V014: secure, single-use password recovery for existing Oracle users.
-- Requires immutable V001-V013 ledger. Apply only after operator preflight.
-- Never rerun a partially applied migration: Oracle DDL auto-commits.
-- SHA256 covers exactly the LF-normalized bytes between the two DDL markers.
-- ============================================================================
SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
BEGIN
    IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CON_NAME') <> 'FREEPDB1' THEN
        RAISE_APPLICATION_ERROR(-20914, 'V014 requires PAWCARE_APP in FREEPDB1.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
    WHERE provider='ORACLE' AND migration_version IN (
        'V001','V002','V003','V004','V005','V006','V007',
        'V008','V009','V010','V011','V012','V013');
    IF v_predecessors <> 13 THEN
        RAISE_APPLICATION_ERROR(-20914, 'V014 requires V001-V013 in the migration ledger.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
    WHERE migration_version='V014';
    IF v_existing <> 0 THEN
        RAISE_APPLICATION_ERROR(-20914, 'V014 is already applied.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS WHERE OBJECT_NAME IN
        ('PASSWORD_RESET_TOKENS','IX_PWD_RESET_USER','PK_PASSWORD_RESET',
         'FK_PASSWORD_RESET_USER','UQ_PASSWORD_RESET_HASH',
         'CK_PASSWORD_RESET_HASH','CK_PASSWORD_RESET_EXPIRY');
    IF v_existing <> 0 THEN
        RAISE_APPLICATION_ERROR(-20914, 'V014 objects already exist; inspect partial deployment.');
    END IF;
END;
/

-- BEGIN V014 DDL (checksum scope starts after this line)

CREATE TABLE PASSWORD_RESET_TOKENS (
    reset_id    NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id     NUMBER(19,0) NOT NULL,
    token_hash  CHAR(64 BYTE) NOT NULL,
    expires_at  TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    used_at     TIMESTAMP(6) WITH TIME ZONE,
    created_at  TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_PASSWORD_RESET PRIMARY KEY (reset_id),
    CONSTRAINT FK_PASSWORD_RESET_USER FOREIGN KEY (user_id) REFERENCES USERS(user_id),
    CONSTRAINT UQ_PASSWORD_RESET_HASH UNIQUE (token_hash),
    CONSTRAINT CK_PASSWORD_RESET_HASH CHECK (REGEXP_LIKE(token_hash, '^[0-9a-f]{64}$')),
    CONSTRAINT CK_PASSWORD_RESET_EXPIRY CHECK (expires_at > created_at)
);

CREATE INDEX IX_PWD_RESET_USER ON PASSWORD_RESET_TOKENS
    (user_id, created_at, used_at);

-- END V014 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version,description,provider,checksum_sha256,applied_at)
VALUES
    ('V014','V014_password_recovery.sql','ORACLE',
     'dfa3c43895a20e1e4a51e55f406e340b71e84582bfc9abf0f6c7adebc550e6e8',SYSTIMESTAMP);
COMMIT;
PROMPT V014 applied.
