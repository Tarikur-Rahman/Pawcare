-- Run from the PawCare repository root in an authenticated SQL*Plus session.
-- Do not use the historical all-migrations script on the existing database.
SET ECHO OFF
SET VERIFY OFF
SET FEEDBACK ON
SET DEFINE ON
SET SERVEROUTPUT ON SIZE UNLIMITED
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT PawCare | V014 preflight (READ ONLY)
@database\oracle\deployment\preflight_v014_read_only.sql
SET DEFINE ON

ACCEPT V014_APPROVAL CHAR PROMPT 'Type APPLY_V014 to authorize the one-time Oracle DDL: '
DECLARE
    v_approval VARCHAR2(30) := UPPER(TRIM('&&V014_APPROVAL'));
BEGIN
    IF v_approval <> 'APPLY_V014' THEN
        RAISE_APPLICATION_ERROR(-20914,'V014 deployment was not approved.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | Explicit APPLY_V014 approval received.');
END;
/
UNDEFINE V014_APPROVAL

PROMPT PawCare | Apply only immutable V014
@database\oracle\migrations\V014_password_recovery.sql

PROMPT PawCare | Verify V014 (READ ONLY)
@database\oracle\deployment\verify_v014.sql

PROMPT PawCare | V014 completed successfully
