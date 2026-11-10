-- ============================================================================
-- PawCare | Oracle seed 001: stable reference data
-- Path: database/oracle/seeds/001_reference_data.sql
-- Oracle 19c+; SQL*Plus / SQLcl; run as PAWCARE_APP after V001-V012.
--
-- This schema stores most enums in CHECK constraints, not lookup tables.
-- Therefore this script intentionally populates ONLY the FOOD_CATEGORIES
-- taxonomy supported by V009. It does not create fictitious reference tables.
-- Safe characteristics: inserts missing slugs only; never updates or deletes
-- an existing category. Re-runnable. No credentials, users, or orders.
-- ============================================================================
SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT PawCare | Reference data preflight ...
DECLARE
    v_count NUMBER;
BEGIN
    IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
        RAISE_APPLICATION_ERROR(-20501, 'Connect as PAWCARE_APP in the intended Oracle PDB.');
    END IF;
    SELECT COUNT(*) INTO v_count FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN (
       'V001','V002','V003','V004','V005','V006',
       'V007','V008','V009','V010','V011','V012');
    IF v_count <> 12 THEN
        RAISE_APPLICATION_ERROR(-20502, 'Apply and verify V001 through V012 before seeding.');
    END IF;
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'FOOD_CATEGORIES';
    IF v_count <> 1 THEN
        RAISE_APPLICATION_ERROR(-20503, 'FOOD_CATEGORIES is missing. Apply V009 first.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('Reference data preflight passed.');
END;
/

-- Canonical top-level categories. Slugs are stable API identifiers.
-- Existing rows are deliberately left unchanged, including their status.
MERGE INTO FOOD_CATEGORIES c
USING (
    SELECT 'dog-food' slug, 'Dog Food' name FROM DUAL UNION ALL
    SELECT 'cat-food', 'Cat Food' FROM DUAL UNION ALL
    SELECT 'bird-food', 'Bird Food' FROM DUAL UNION ALL
    SELECT 'fish-food', 'Fish Food' FROM DUAL UNION ALL
    SELECT 'small-pet-food', 'Small Pet Food' FROM DUAL UNION ALL
    SELECT 'pet-treats', 'Pet Treats' FROM DUAL
) s
ON (c.slug = s.slug)
WHEN NOT MATCHED THEN
    INSERT (name, slug, status)
    VALUES (s.name, s.slug, 'ACTIVE');

-- Confirm all six canonical slugs are now present before committing.
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
      FROM FOOD_CATEGORIES
     WHERE slug IN ('dog-food','cat-food','bird-food',
                    'fish-food','small-pet-food','pet-treats');
    IF v_count <> 6 THEN
        RAISE_APPLICATION_ERROR(-20504, 'Expected six food category slugs.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('Reference data checked: six canonical category slugs.');
END;
/
COMMIT;

PROMPT PawCare | Reference data seeded (insert-only; safe to rerun).
SELECT slug, name, status
  FROM FOOD_CATEGORIES
 WHERE slug IN ('dog-food','cat-food','bird-food',
                'fish-food','small-pet-food','pet-treats')
 ORDER BY slug;
