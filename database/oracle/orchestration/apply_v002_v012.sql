-- PawCare Oracle interactive migration orchestration (V002-V013)
-- Run only inside an already authenticated SQL*Plus/SQLcl session.
-- This file never connects, prompts for, or receives a password.
--
-- Required starting state:
--   SESSION_USER=PAWCARE_APP, CURRENT_SCHEMA=PAWCARE_APP, CON_NAME=FREEPDB1
--   SCHEMA_MIGRATIONS contains exactly the immutable V001 ledger row.
--
-- Oracle DDL is not transactional. Any failure stops this script and may leave
-- partial DDL. Inspect and reconcile the database before any later retry.

SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET DEFINE OFF
SET HEADING ON
SET LINESIZE 240
SET PAGESIZE 200
SET SERVEROUTPUT ON SIZE UNLIMITED
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

SPOOL integration\results\oracle_execution\interactive_migration_evidence.txt

PROMPT PawCare | Interactive migration orchestration started.
PROMPT PawCare | Credentials are not accepted by this script and are not logged.

DECLARE
    v_session_user VARCHAR2(128);
    v_current_schema VARCHAR2(128);
    v_container VARCHAR2(128);
    v_ledger_rows PLS_INTEGER;
    v_v001_rows PLS_INTEGER;
    v_v001_checksum SCHEMA_MIGRATIONS.checksum_sha256%TYPE;
BEGIN
    v_session_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    v_current_schema := SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA');
    v_container := SYS_CONTEXT('USERENV', 'CON_NAME');

    IF v_session_user <> 'PAWCARE_APP'
       OR v_current_schema <> 'PAWCARE_APP'
       OR v_container <> 'FREEPDB1' THEN
        RAISE_APPLICATION_ERROR(
            -20800,
            'Identity assertion failed; expected PAWCARE_APP/PAWCARE_APP/FREEPDB1.'
        );
    END IF;

    SELECT COUNT(*),
           NVL(MAX(CASE WHEN migration_version = 'V001'
                        AND provider = 'ORACLE'
                        THEN 1 ELSE 0 END), 0),
           MAX(CASE WHEN migration_version = 'V001'
                    THEN checksum_sha256 END)
      INTO v_ledger_rows, v_v001_rows, v_v001_checksum
      FROM SCHEMA_MIGRATIONS;

    IF v_ledger_rows <> 1 OR v_v001_rows <> 1
       OR v_v001_checksum <> 'fef2db2ea4e267789fda1d6307d2ac87d98156355b16d190bd602e10d62b15e1' THEN
        RAISE_APPLICATION_ERROR(
            -20801,
            'Initial ledger assertion failed; expected exactly immutable V001.'
        );
    END IF;

    DBMS_OUTPUT.PUT_LINE(
        'PASS | identity PAWCARE_APP/PAWCARE_APP/FREEPDB1; initial ledger V001 checksum verified.'
    );
END;
/

PROMPT PawCare | Applying V002 ...
@database\oracle\migrations\V002_identity_profiles.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V002'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '7dd3cf6be4820d1cc27271840c1712e5a45897163ded0ae95480f96519bbea46'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('USER_PROFILES','USER_CAPABILITIES','SESSIONS','ADDRESSES');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 2 OR v_version_rows <> 1 OR v_objects <> 4 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20802, 'V002 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V002 ledger checksum and four expected tables verified.');
END;
/

PROMPT PawCare | Applying V003 ...
@database\oracle\migrations\V003_assets_notifications_audit.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V003'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '26729665ff7d57bbe61a9bf590fc5e144e653d2a469abc55c22a62572bd24d0e'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('FILE_ASSETS','NOTIFICATIONS','DEVICE_TOKENS','AUDIT_EVENTS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 3 OR v_version_rows <> 1 OR v_objects <> 4 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20803, 'V003 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V003 ledger checksum and four expected tables verified.');
END;
/

PROMPT PawCare | Applying V004 ...
@database\oracle\migrations\V004_adoption.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V004'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '4d31b937e7784b1e934dfa125b949c9b1d133b430101f668914c67d3bcf5fd33'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('ADOPTION_LISTINGS','ADOPTION_MEDIA','ADOPTION_APPLICATIONS','ADOPTION_HANDOVERS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 4 OR v_version_rows <> 1 OR v_objects <> 4 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20804, 'V004 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V004 ledger checksum and four expected tables verified.');
END;
/

PROMPT PawCare | Applying V005 ...
@database\oracle\migrations\V005_donations.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V005'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '3355a2d2b3780622ff300dfb1d280d374d96f037fe7d9908d258ae3bddc7a165'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('DONATION_CAMPAIGNS','DONATION_CONTRIBUTIONS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 5 OR v_version_rows <> 1 OR v_objects <> 2 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20805, 'V005 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V005 ledger checksum and two expected tables verified.');
END;
/

PROMPT PawCare | Applying V006 ...
@database\oracle\migrations\V006_pet_marketplace.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V006'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '6cdd90eb72b20d30cf50e107e88b2de08702bff509f1f907d2fbea56f838c76c'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('PET_SALE_LISTINGS','PET_SALE_MEDIA','PET_SALE_INQUIRIES','PET_SALE_TRANSACTIONS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 6 OR v_version_rows <> 1 OR v_objects <> 4 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20806, 'V006 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V006 ledger checksum and four expected tables verified.');
END;
/

PROMPT PawCare | Applying V007 ...
@database\oracle\migrations\V007_moderation_favorites.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V007'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = 'dec968b0b293c3d3fbd109a17cd72ef8719c81d1a03a7577afc6c5d2628e365f'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('LISTING_REPORTS','MODERATION_ACTIONS','FAVORITES');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 7 OR v_version_rows <> 1 OR v_objects <> 3 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20807, 'V007 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V007 ledger checksum and three expected tables verified.');
END;
/

PROMPT PawCare | Applying V008 ...
@database\oracle\migrations\V008_lost_found.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V008'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '99704d954414bac6b6d181cc102d8b25a61176e2a13373b002de35fc9c9b0d85'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('LOST_FOUND_POSTS','LOST_FOUND_MEDIA','SIGHTINGS','REUNIFICATION_CLAIMS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 8 OR v_version_rows <> 1 OR v_objects <> 4 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20808, 'V008 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V008 ledger checksum and four expected tables verified.');
END;
/

PROMPT PawCare | Applying V009 ...
@database\oracle\migrations\V009_food_catalog_inventory.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V009'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '116016b508212beb231ad986ad688cef7b980851193d0c61c747321ef0c00f4a'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('FOOD_CATEGORIES','FOOD_PRODUCTS','PRODUCT_IMAGES','INVENTORY_STOCK','INVENTORY_MOVEMENTS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 9 OR v_version_rows <> 1 OR v_objects <> 5 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20809, 'V009 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V009 ledger checksum and five expected tables verified.');
END;
/

PROMPT PawCare | Applying V010 ...
@database\oracle\migrations\V010_cart_orders.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V010'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '3a26977be546b113b575e950147954f618b29a10843c48ec770580aeabf492e9'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('CARTS','CART_ITEMS','ORDERS','ORDER_ITEMS','ORDER_STOCK_RESERVATIONS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 10 OR v_version_rows <> 1 OR v_objects <> 5 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20810, 'V010 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V010 ledger checksum and five expected tables verified.');
END;
/

PROMPT PawCare | Applying V011 ...
@database\oracle\migrations\V011_payments_delivery_reviews.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_objects PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V011'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = '5d999b53639aead0322b657f42190829924022280ea8e82a5f52cfa4da2d82e1'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_objects FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('PAYMENTS','PAYMENT_EVENTS','SHIPMENTS','PRODUCT_REVIEWS');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 11 OR v_version_rows <> 1 OR v_objects <> 4 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20811, 'V011 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V011 ledger checksum and four expected tables verified.');
END;
/

PROMPT PawCare | Applying V012 ...
@database\oracle\migrations\V012_outbox_keys_indexes.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_tables PLS_INTEGER;
    v_views PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V012'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = 'cd28feb4529e134d6bfe9072e9be1af2250d1ab98784b6bab4180940b2de1507'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_tables FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE'
       AND OBJECT_NAME IN ('OUTBOX_EVENTS','IDEMPOTENCY_KEYS','PET_LISTING_LOCKS');
    SELECT COUNT(*) INTO v_views FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'VIEW'
       AND OBJECT_NAME IN ('VW_PUBLIC_ADOPTIONS','VW_PUBLIC_PET_SALES','VW_PUBLIC_LOST_FOUND','VW_PUBLIC_FOOD');
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 12 OR v_version_rows <> 1
       OR v_tables <> 3 OR v_views <> 4 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20812, 'V012 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V012 ledger checksum, three tables and four views verified.');
END;
/

PROMPT PawCare | Applying V013 ...
@database\oracle\migrations\V013_auth_verification.sql
DECLARE
    v_ledger_rows PLS_INTEGER;
    v_version_rows PLS_INTEGER;
    v_tables PLS_INTEGER;
    v_invalid PLS_INTEGER;
BEGIN
    SELECT COUNT(*),
           NVL(SUM(CASE WHEN migration_version = 'V013'
                         AND provider = 'ORACLE'
                         AND checksum_sha256 = 'eda514f1d6284e7a00897ba4d7ba5f01bbc678163f707a5c2a0a6675f098d5b3'
                        THEN 1 ELSE 0 END), 0)
      INTO v_ledger_rows, v_version_rows
      FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_tables FROM USER_OBJECTS
     WHERE OBJECT_TYPE = 'TABLE' AND OBJECT_NAME = 'EMAIL_VERIFICATION_TOKENS';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_ledger_rows <> 13 OR v_version_rows <> 1 OR v_tables <> 1 OR v_invalid <> 0 THEN
        RAISE_APPLICATION_ERROR(-20813, 'V013 assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | V013 ledger checksum and verification-token table verified.');
END;
/

PROMPT PawCare | Applying reference seed only ...
@database\oracle\seeds\001_reference_data.sql

PROMPT PawCare | Running foreign-key verification ...
@database\oracle\verification\verify_foreign_keys.sql
PROMPT PawCare | Running index verification ...
@database\oracle\verification\verify_indexes.sql
PROMPT PawCare | Running reference-seed verification ...
@database\oracle\verification\verify_seed_consistency.sql

DECLARE
    v_session_user VARCHAR2(128);
    v_current_schema VARCHAR2(128);
    v_container VARCHAR2(128);
    v_ledger_rows PLS_INTEGER;
    v_invalid PLS_INTEGER;
    v_categories PLS_INTEGER;
BEGIN
    v_session_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    v_current_schema := SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA');
    v_container := SYS_CONTEXT('USERENV', 'CON_NAME');
    SELECT COUNT(*) INTO v_ledger_rows FROM SCHEMA_MIGRATIONS;
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID' AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    SELECT COUNT(*) INTO v_categories FROM FOOD_CATEGORIES
     WHERE slug IN ('dog-food','cat-food','bird-food','fish-food','small-pet-food','pet-treats');

    IF v_session_user <> 'PAWCARE_APP'
       OR v_current_schema <> 'PAWCARE_APP'
       OR v_container <> 'FREEPDB1'
       OR v_ledger_rows <> 13
       OR v_invalid <> 0
       OR v_categories <> 6 THEN
        RAISE_APPLICATION_ERROR(-20813, 'Final schema assertion failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE(
        'PASS | final identity, 13 migration rows, valid programmable objects, and six reference categories verified.'
    );
END;
/

PROMPT PawCare | Interactive migration orchestration completed successfully.
SPOOL OFF
