-- ============================================================================
-- PawCare | Oracle database verification
-- Path: database/oracle/verification/verify_foreign_keys.sql
-- Purpose: Check all 99 expected FK names, source/target columns, state and schema.
-- Based on the actual PawCare Oracle migration files V001 through V012.
-- Compatible with Oracle 19c+; SQL*Plus / SQLcl; run as PAWCARE_APP.
-- READ-ONLY: does not create, change, or delete database objects or records.
-- Run after V001-V012; seed verifier also requires seed 001.
-- Fails with a nonzero SQL*Plus / SQLcl exit code on mandatory check failures.
-- These are static/referential/data checks, not a substitute for live app tests.
-- ============================================================================
SET ECHO OFF
SET FEEDBACK OFF
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON SIZE UNLIMITED
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK


PROMPT PawCare | Checking foreign-key definitions and enforcement ...
DECLARE
    v_migrations PLS_INTEGER;
    v_checked PLS_INTEGER := 0;
    v_failed PLS_INTEGER := 0;
    v_expected PLS_INTEGER := 0;
    TYPE t_seen IS TABLE OF BOOLEAN INDEX BY VARCHAR2(128);
    seen t_seen;

    PROCEDURE failure(p_message IN VARCHAR2) IS
    BEGIN
        v_failed := v_failed + 1;
        DBMS_OUTPUT.PUT_LINE('FAIL | ' || p_message);
    END;

    PROCEDURE verify_fk(
        p_name IN VARCHAR2,
        p_child IN VARCHAR2,
        p_child_cols IN VARCHAR2,
        p_parent IN VARCHAR2,
        p_parent_cols IN VARCHAR2
    ) IS
        v_child USER_CONSTRAINTS.TABLE_NAME%TYPE;
        v_parent USER_CONSTRAINTS.TABLE_NAME%TYPE;
        v_parent_type USER_CONSTRAINTS.CONSTRAINT_TYPE%TYPE;
        v_child_cols VARCHAR2(4000);
        v_parent_cols VARCHAR2(4000);
        v_status USER_CONSTRAINTS.STATUS%TYPE;
        v_validated USER_CONSTRAINTS.VALIDATED%TYPE;
        v_ref_owner USER_CONSTRAINTS.R_OWNER%TYPE;
        v_delete_rule USER_CONSTRAINTS.DELETE_RULE%TYPE;
    BEGIN
        seen(p_name) := TRUE;
        v_expected := v_expected + 1;
        BEGIN
            SELECT c.table_name, p.table_name, p.constraint_type,
                   (SELECT LISTAGG(cc.column_name, ',')
                            WITHIN GROUP (ORDER BY cc.position)
                      FROM USER_CONS_COLUMNS cc
                     WHERE cc.constraint_name = c.constraint_name),
                   (SELECT LISTAGG(pc.column_name, ',')
                            WITHIN GROUP (ORDER BY pc.position)
                      FROM USER_CONS_COLUMNS pc
                     WHERE pc.constraint_name = p.constraint_name),
                   c.status, c.validated, c.r_owner, c.delete_rule
              INTO v_child, v_parent, v_parent_type,
                   v_child_cols, v_parent_cols,
                   v_status, v_validated, v_ref_owner, v_delete_rule
              FROM USER_CONSTRAINTS c
              LEFT JOIN USER_CONSTRAINTS p
                ON p.constraint_name = c.r_constraint_name
             WHERE c.constraint_name = p_name
               AND c.constraint_type = 'R';
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                failure('Missing FK: ' || p_name || ' on ' || p_child);
                RETURN;
        END;
        v_checked := v_checked + 1;
        IF v_child <> p_child
           OR NVL(v_child_cols,'?') <> p_child_cols
           OR NVL(v_parent,'?') <> p_parent
           OR NVL(v_parent_cols,'?') <> p_parent_cols
           OR NVL(v_parent_type,'?') NOT IN ('P','U')
           OR NVL(v_ref_owner,'?') <> SYS_CONTEXT('USERENV','CURRENT_SCHEMA') THEN
            failure('FK definition drift: ' || p_name ||
                    ' [' || v_child || '(' || v_child_cols || ') -> ' ||
                    v_parent || '(' || v_parent_cols || ')]');
        END IF;
        IF v_status <> 'ENABLED' OR v_validated <> 'VALIDATED' THEN
            failure('FK not ENABLED/VALIDATED: ' || p_name ||
                    ' [' || v_status || '/' || v_validated || ']');
        END IF;
        IF v_delete_rule <> 'NO ACTION' THEN
            failure('Unexpected FK DELETE_RULE for ' || p_name || ': ' || v_delete_rule);
        END IF;
    END;
BEGIN
    IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
        RAISE_APPLICATION_ERROR(-20700,
            'Connect as PAWCARE_APP with CURRENT_SCHEMA=PAWCARE_APP.');
    END IF;
    SELECT COUNT(*) INTO v_migrations FROM SCHEMA_MIGRATIONS
      WHERE migration_version IN
        ('V001','V002','V003','V004','V005','V006',
         'V007','V008','V009','V010','V011','V012')
        AND provider = 'ORACLE';
    IF v_migrations <> 12 THEN
        RAISE_APPLICATION_ERROR(-20700,
            'V001-V012 Oracle migrations must be applied before verification.');
    END IF;

    -- Baseline generated from the actual V001-V012 Oracle DDL; includes
    -- composite keys, the self-FK and the V003 profile/avatar ALTER TABLE FK.
    verify_fk('FK_PETS_OWNER', 'PETS', 'OWNER_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_VACC_PET', 'VACCINATIONS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_VACC_VET', 'VACCINATIONS', 'VETERINARIAN_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_VACC_AUTHOR', 'VACCINATIONS', 'RECORDED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_MED_PET', 'MEDICATIONS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_MED_AUTHOR', 'MEDICATIONS', 'CREATED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_CARE_PET', 'CARE_TASKS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_CARE_AUTHOR', 'CARE_TASKS', 'CREATED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_APPT_PET', 'APPOINTMENTS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_APPT_VET', 'APPOINTMENTS', 'VET_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_APPT_AUTHOR', 'APPOINTMENTS', 'CREATED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_EXP_PET', 'EXPENSES', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_EXP_AUTHOR', 'EXPENSES', 'CREATED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_PROFILE_USER', 'USER_PROFILES', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_CAP_USER', 'USER_CAPABILITIES', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_CAP_GRANTOR', 'USER_CAPABILITIES', 'GRANTED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_SESSION_USER', 'SESSIONS', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_ADDRESS_USER', 'ADDRESSES', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_FILE_OWNER', 'FILE_ASSETS', 'OWNER_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_PROFILE_AVATAR', 'USER_PROFILES', 'AVATAR_FILE_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_NOTIF_USER', 'NOTIFICATIONS', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_DEVICE_USER', 'DEVICE_TOKENS', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_AUDIT_ACTOR', 'AUDIT_EVENTS', 'ACTOR_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_ADOPT_PET', 'ADOPTION_LISTINGS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_ADOPT_CREATOR', 'ADOPTION_LISTINGS', 'CREATOR_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_ADOPT_REVIEWER', 'ADOPTION_LISTINGS', 'REVIEWED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_ADOPT_MEDIA_LISTING', 'ADOPTION_MEDIA', 'ADOPTION_ID',
              'ADOPTION_LISTINGS', 'ADOPTION_ID');
    verify_fk('FK_ADOPT_MEDIA_FILE', 'ADOPTION_MEDIA', 'FILE_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_ADOPT_APP_LISTING', 'ADOPTION_APPLICATIONS', 'ADOPTION_ID',
              'ADOPTION_LISTINGS', 'ADOPTION_ID');
    verify_fk('FK_ADOPT_APP_USER', 'ADOPTION_APPLICATIONS', 'APPLICANT_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_ADOPT_APP_REVIEW', 'ADOPTION_APPLICATIONS', 'REVIEWED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_HANDOVER_LISTING', 'ADOPTION_HANDOVERS', 'ADOPTION_ID',
              'ADOPTION_LISTINGS', 'ADOPTION_ID');
    verify_fk('FK_HANDOVER_APP', 'ADOPTION_HANDOVERS', 'APPLICATION_ID',
              'ADOPTION_APPLICATIONS', 'APPLICATION_ID');
    verify_fk('FK_HANDOVER_APP_MATCH', 'ADOPTION_HANDOVERS', 'ADOPTION_ID,APPLICATION_ID,NEW_OWNER_ID',
              'ADOPTION_APPLICATIONS', 'ADOPTION_ID,APPLICATION_ID,APPLICANT_ID');
    verify_fk('FK_HANDOVER_PET', 'ADOPTION_HANDOVERS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_HANDOVER_PRIOR', 'ADOPTION_HANDOVERS', 'PRIOR_OWNER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_HANDOVER_NEW', 'ADOPTION_HANDOVERS', 'NEW_OWNER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_DONATION_BEN', 'DONATION_CAMPAIGNS', 'BENEFICIARY_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_DONATION_REVIEW', 'DONATION_CAMPAIGNS', 'REVIEWED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_CONTRIB_CAMPAIGN', 'DONATION_CONTRIBUTIONS', 'CAMPAIGN_ID',
              'DONATION_CAMPAIGNS', 'CAMPAIGN_ID');
    verify_fk('FK_CONTRIB_DONOR', 'DONATION_CONTRIBUTIONS', 'DONOR_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_SALE_PET', 'PET_SALE_LISTINGS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_SALE_SELLER', 'PET_SALE_LISTINGS', 'SELLER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_SALE_EVIDENCE', 'PET_SALE_LISTINGS', 'WELFARE_EVIDENCE_FILE_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_SALE_REVIEWER', 'PET_SALE_LISTINGS', 'REVIEWED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_SALE_MEDIA_LISTING', 'PET_SALE_MEDIA', 'SALE_LISTING_ID',
              'PET_SALE_LISTINGS', 'SALE_LISTING_ID');
    verify_fk('FK_SALE_MEDIA_FILE', 'PET_SALE_MEDIA', 'FILE_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_SALE_INQ_LISTING', 'PET_SALE_INQUIRIES', 'SALE_LISTING_ID',
              'PET_SALE_LISTINGS', 'SALE_LISTING_ID');
    verify_fk('FK_SALE_INQ_BUYER', 'PET_SALE_INQUIRIES', 'BUYER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_SALE_TXN_LISTING', 'PET_SALE_TRANSACTIONS', 'SALE_LISTING_ID',
              'PET_SALE_LISTINGS', 'SALE_LISTING_ID');
    verify_fk('FK_SALE_TXN_PET', 'PET_SALE_TRANSACTIONS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_SALE_TXN_SELLER', 'PET_SALE_TRANSACTIONS', 'SELLER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_SALE_TXN_BUYER', 'PET_SALE_TRANSACTIONS', 'BUYER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_REPORT_USER', 'LISTING_REPORTS', 'REPORTER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_REPORT_REVIEWER', 'LISTING_REPORTS', 'ASSIGNED_REVIEWER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_MOD_ACTOR', 'MODERATION_ACTIONS', 'ACTOR_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_MOD_REPORT', 'MODERATION_ACTIONS', 'REPORT_ID',
              'LISTING_REPORTS', 'REPORT_ID');
    verify_fk('FK_FAV_USER', 'FAVORITES', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_LOST_PET', 'LOST_FOUND_POSTS', 'PET_ID',
              'PETS', 'PET_ID');
    verify_fk('FK_LOST_POSTER', 'LOST_FOUND_POSTS', 'POSTER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_LOST_REVIEW', 'LOST_FOUND_POSTS', 'REVIEWED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_LOST_MEDIA_POST', 'LOST_FOUND_MEDIA', 'POST_ID',
              'LOST_FOUND_POSTS', 'POST_ID');
    verify_fk('FK_LOST_MEDIA_FILE', 'LOST_FOUND_MEDIA', 'FILE_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_SIGHT_POST', 'SIGHTINGS', 'POST_ID',
              'LOST_FOUND_POSTS', 'POST_ID');
    verify_fk('FK_SIGHT_REPORTER', 'SIGHTINGS', 'REPORTER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_SIGHT_EVIDENCE', 'SIGHTINGS', 'EVIDENCE_FILE_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_REUNION_POST', 'REUNIFICATION_CLAIMS', 'POST_ID',
              'LOST_FOUND_POSTS', 'POST_ID');
    verify_fk('FK_REUNION_CLAIMANT', 'REUNIFICATION_CLAIMS', 'CLAIMANT_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_REUNION_PROOF', 'REUNIFICATION_CLAIMS', 'PROOF_ASSET_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_REUNION_REVIEWER', 'REUNIFICATION_CLAIMS', 'REVIEWED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_FOOD_CAT_PARENT', 'FOOD_CATEGORIES', 'PARENT_ID',
              'FOOD_CATEGORIES', 'CATEGORY_ID');
    verify_fk('FK_FOOD_PROD_CAT', 'FOOD_PRODUCTS', 'CATEGORY_ID',
              'FOOD_CATEGORIES', 'CATEGORY_ID');
    verify_fk('FK_PROD_IMG_PRODUCT', 'PRODUCT_IMAGES', 'PRODUCT_ID',
              'FOOD_PRODUCTS', 'PRODUCT_ID');
    verify_fk('FK_PROD_IMG_FILE', 'PRODUCT_IMAGES', 'FILE_ID',
              'FILE_ASSETS', 'FILE_ID');
    verify_fk('FK_STOCK_PRODUCT', 'INVENTORY_STOCK', 'PRODUCT_ID',
              'FOOD_PRODUCTS', 'PRODUCT_ID');
    verify_fk('FK_MOVE_PRODUCT', 'INVENTORY_MOVEMENTS', 'PRODUCT_ID',
              'FOOD_PRODUCTS', 'PRODUCT_ID');
    verify_fk('FK_MOVE_ACTOR', 'INVENTORY_MOVEMENTS', 'CREATED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_CART_USER', 'CARTS', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_CART_ITEM_CART', 'CART_ITEMS', 'CART_ID',
              'CARTS', 'CART_ID');
    verify_fk('FK_CART_ITEM_PRODUCT', 'CART_ITEMS', 'PRODUCT_ID',
              'FOOD_PRODUCTS', 'PRODUCT_ID');
    verify_fk('FK_ORDER_USER', 'ORDERS', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_ORDER_SHIP_ADDR', 'ORDERS', 'SHIPPING_ADDRESS_ID',
              'ADDRESSES', 'ADDRESS_ID');
    verify_fk('FK_ORDER_ITEM_ORDER', 'ORDER_ITEMS', 'ORDER_ID',
              'ORDERS', 'ORDER_ID');
    verify_fk('FK_ORDER_ITEM_PRODUCT', 'ORDER_ITEMS', 'PRODUCT_ID',
              'FOOD_PRODUCTS', 'PRODUCT_ID');
    verify_fk('FK_RESERV_ORDER', 'ORDER_STOCK_RESERVATIONS', 'ORDER_ID',
              'ORDERS', 'ORDER_ID');
    verify_fk('FK_RESERV_PRODUCT', 'ORDER_STOCK_RESERVATIONS', 'PRODUCT_ID',
              'INVENTORY_STOCK', 'PRODUCT_ID');
    verify_fk('FK_RESERV_ORDER_LINE', 'ORDER_STOCK_RESERVATIONS', 'ORDER_ID,PRODUCT_ID',
              'ORDER_ITEMS', 'ORDER_ID,PRODUCT_ID');
    verify_fk('FK_PAY_ORDER', 'PAYMENTS', 'ORDER_ID',
              'ORDERS', 'ORDER_ID');
    verify_fk('FK_PAY_SALE', 'PAYMENTS', 'SALE_TXN_ID',
              'PET_SALE_TRANSACTIONS', 'SALE_TXN_ID');
    verify_fk('FK_PAY_DONATION', 'PAYMENTS', 'CONTRIBUTION_ID',
              'DONATION_CONTRIBUTIONS', 'CONTRIBUTION_ID');
    verify_fk('FK_PAYMENT_EVENT_PAY', 'PAYMENT_EVENTS', 'PAYMENT_ID',
              'PAYMENTS', 'PAYMENT_ID');
    verify_fk('FK_SHIPMENT_ORDER', 'SHIPMENTS', 'ORDER_ID',
              'ORDERS', 'ORDER_ID');
    verify_fk('FK_REVIEW_PRODUCT', 'PRODUCT_REVIEWS', 'PRODUCT_ID',
              'FOOD_PRODUCTS', 'PRODUCT_ID');
    verify_fk('FK_REVIEW_BUYER', 'PRODUCT_REVIEWS', 'BUYER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_REVIEW_ORDER_ITEM', 'PRODUCT_REVIEWS', 'ORDER_ITEM_ID',
              'ORDER_ITEMS', 'ORDER_ITEM_ID');
    verify_fk('FK_REVIEW_PURCHASE_PRODUCT', 'PRODUCT_REVIEWS', 'ORDER_ITEM_ID,PRODUCT_ID',
              'ORDER_ITEMS', 'ORDER_ITEM_ID,PRODUCT_ID');
    verify_fk('FK_REVIEW_MODERATOR', 'PRODUCT_REVIEWS', 'MODERATED_BY_USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_IDEMP_USER', 'IDEMPOTENCY_KEYS', 'USER_ID',
              'USERS', 'USER_ID');
    verify_fk('FK_LISTING_LOCK_PET', 'PET_LISTING_LOCKS', 'PET_ID',
              'PETS', 'PET_ID');

    -- A new FK not represented in this versioned baseline is schema drift.
    FOR r IN (SELECT constraint_name FROM USER_CONSTRAINTS
               WHERE constraint_type = 'R' ORDER BY constraint_name) LOOP
        IF NOT seen.EXISTS(r.constraint_name) THEN
            failure('Unexpected FK not in V001-V012 baseline: ' || r.constraint_name);
        END IF;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('Expected FK definitions: ' || v_expected);
    DBMS_OUTPUT.PUT_LINE('Located FK definitions:  ' || v_checked);
    DBMS_OUTPUT.PUT_LINE('Failures:                ' || v_failed);
    IF v_expected <> 99 OR v_failed <> 0 THEN
        RAISE_APPLICATION_ERROR(-20701,
            'PawCare foreign-key verification failed; see FAIL lines above.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | All 99 expected foreign keys are enabled and validated.');
    DBMS_OUTPUT.PUT_LINE('NOTE | ENABLE VALIDATE confirms FK data integrity at validation time.');
END;
/
