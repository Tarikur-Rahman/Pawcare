-- PawCare Oracle V013-only deployment.
-- Run only in an already authenticated SQL*Plus/SQLcl session.
-- Never runs V001-V012, seeds, or the full orchestration.
SET ECHO OFF
SET VERIFY OFF
SET FEEDBACK ON
SET DEFINE ON
SET SERVEROUTPUT ON SIZE UNLIMITED
SET LINESIZE 240
SET PAGESIZE 200
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE

SPOOL integration\results\oracle_execution\v013_deployment_evidence.txt
PROMPT PawCare | V013 deployment preflight
@database\oracle\deployment\preflight_v013_read_only.sql

ACCEPT V013_APPROVAL CHAR PROMPT 'Type APPLY_V013 to approve the one-time V013 DDL: '
DECLARE
    v_approval VARCHAR2(30) := UPPER(TRIM('&&V013_APPROVAL'));
BEGIN
    IF v_approval <> 'APPLY_V013' THEN
        RAISE_APPLICATION_ERROR(-20905, 'V013 deployment not approved; no DDL was run.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | Explicit V013 approval received.');
END;
/
UNDEFINE V013_APPROVAL

PROMPT PawCare | Applying immutable V013 only
@database\oracle\migrations\V013_auth_verification.sql

PROMPT PawCare | Verifying V013
@database\oracle\deployment\verify_v013.sql

SPOOL OFF
EXIT SUCCESS
