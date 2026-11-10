-- ============================================================================
-- PawCare | Oracle database verification
-- Path: database/oracle/verification/verify_indexes.sql
-- Purpose: Check all 109 explicit indexes and constraint-backed indexes.
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


PROMPT PawCare | Checking explicit indexes, uniqueness, usability ...
DECLARE
    v_migrations PLS_INTEGER;
    v_expected PLS_INTEGER := 0;
    v_checked PLS_INTEGER := 0;
    v_failed PLS_INTEGER := 0;
    v_warnings PLS_INTEGER := 0;
    TYPE t_seen IS TABLE OF BOOLEAN INDEX BY VARCHAR2(128);
    seen t_seen;

    PROCEDURE failure(p_message IN VARCHAR2) IS
    BEGIN
        v_failed := v_failed + 1;
        DBMS_OUTPUT.PUT_LINE('FAIL | ' || p_message);
    END;
    PROCEDURE warning(p_message IN VARCHAR2) IS
    BEGIN
        v_warnings := v_warnings + 1;
        IF v_warnings <= 20 THEN
            DBMS_OUTPUT.PUT_LINE('WARN | ' || p_message);
        END IF;
    END;
    PROCEDURE verify_index(
        p_name IN VARCHAR2,
        p_table IN VARCHAR2,
        p_uniqueness IN VARCHAR2,
        p_kind IN VARCHAR2,
        p_columns IN VARCHAR2
    ) IS
        v_table USER_INDEXES.TABLE_NAME%TYPE;
        v_uniq USER_INDEXES.UNIQUENESS%TYPE;
        v_type USER_INDEXES.INDEX_TYPE%TYPE;
        v_status USER_INDEXES.STATUS%TYPE;
        v_visibility USER_INDEXES.VISIBILITY%TYPE;
        v_columns VARCHAR2(4000);
    BEGIN
        seen(p_name) := TRUE;
        v_expected := v_expected + 1;
        BEGIN
            SELECT i.table_name, i.uniqueness, i.index_type,
                   i.status, i.visibility,
                   (SELECT LISTAGG(ic.column_name, ',')
                           WITHIN GROUP (ORDER BY ic.column_position)
                      FROM USER_IND_COLUMNS ic
                     WHERE ic.index_name = i.index_name)
              INTO v_table, v_uniq, v_type, v_status, v_visibility, v_columns
              FROM USER_INDEXES i
             WHERE i.index_name = p_name;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                failure('Missing index: ' || p_name || ' on ' || p_table);
                RETURN;
        END;
        v_checked := v_checked + 1;
        IF v_table <> p_table OR v_uniq <> p_uniqueness THEN
            failure('Wrong table/uniqueness: ' || p_name || ' [' ||
                    v_table || '/' || v_uniq || ']');
        END IF;
        IF p_kind = 'NORMAL' THEN
            IF v_type <> 'NORMAL' OR NVL(v_columns,'?') <> p_columns THEN
                failure('Wrong index column order/type: ' || p_name ||
                        ' [' || NVL(v_columns,'?') || '/' || v_type || ']');
            END IF;
        ELSE
            -- Oracle exposes function index expressions via a LONG column.
            -- Verify presence, uniqueness and function-based type; a manual
            -- DBMS_METADATA comparison is needed for exact CASE expression.
            IF v_type NOT LIKE 'FUNCTION-BASED%' THEN
                failure('Expected function-based index: ' || p_name);
            END IF;
        END IF;
        IF v_status <> 'VALID' OR v_visibility <> 'VISIBLE' THEN
            failure('Index invalid/invisible: ' || p_name ||
                    ' [' || v_status || '/' || v_visibility || ']');
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

    -- Explicit CREATE [UNIQUE] INDEX declarations in V001-V012.
    verify_index('IX_USERS_ROLE_STATUS', 'USERS', 'NONUNIQUE', 'NORMAL', 'ROLE,STATUS');
    verify_index('IX_PETS_OWNER_STATUS', 'PETS', 'NONUNIQUE', 'NORMAL', 'OWNER_USER_ID,STATUS');
    verify_index('IX_VACC_PET_ADMIN', 'VACCINATIONS', 'NONUNIQUE', 'NORMAL', 'PET_ID,ADMINISTERED_AT');
    verify_index('IX_VACC_VET', 'VACCINATIONS', 'NONUNIQUE', 'NORMAL', 'VETERINARIAN_USER_ID');
    verify_index('IX_VACC_AUTHOR', 'VACCINATIONS', 'NONUNIQUE', 'NORMAL', 'RECORDED_BY_USER_ID');
    verify_index('IX_MED_PET_STATUS', 'MEDICATIONS', 'NONUNIQUE', 'NORMAL', 'PET_ID,STATUS,START_AT');
    verify_index('IX_MED_AUTHOR', 'MEDICATIONS', 'NONUNIQUE', 'NORMAL', 'CREATED_BY_USER_ID');
    verify_index('IX_CARE_PET_DUE', 'CARE_TASKS', 'NONUNIQUE', 'NORMAL', 'PET_ID,STATUS,DUE_AT');
    verify_index('IX_CARE_AUTHOR', 'CARE_TASKS', 'NONUNIQUE', 'NORMAL', 'CREATED_BY_USER_ID');
    verify_index('IX_APPT_PET_START', 'APPOINTMENTS', 'NONUNIQUE', 'NORMAL', 'PET_ID,STARTS_AT');
    verify_index('IX_APPT_VET_START', 'APPOINTMENTS', 'NONUNIQUE', 'NORMAL', 'VET_USER_ID,STARTS_AT,STATUS');
    verify_index('IX_APPT_AUTHOR', 'APPOINTMENTS', 'NONUNIQUE', 'NORMAL', 'CREATED_BY_USER_ID');
    verify_index('IX_EXP_PET_OCCUR', 'EXPENSES', 'NONUNIQUE', 'NORMAL', 'PET_ID,OCCURRED_AT');
    verify_index('IX_EXP_AUTHOR', 'EXPENSES', 'NONUNIQUE', 'NORMAL', 'CREATED_BY_USER_ID');
    verify_index('UX_APPT_ACTIVE_VET_START', 'APPOINTMENTS', 'UNIQUE', 'FUNCTION', '');
    verify_index('UX_CAP_ACTIVE', 'USER_CAPABILITIES', 'UNIQUE', 'FUNCTION', '');
    verify_index('IX_CAP_USER', 'USER_CAPABILITIES', 'NONUNIQUE', 'NORMAL', 'USER_ID,CAPABILITY,STATUS');
    verify_index('IX_CAP_GRANTOR', 'USER_CAPABILITIES', 'NONUNIQUE', 'NORMAL', 'GRANTED_BY_USER_ID');
    verify_index('IX_SESSIONS_USER', 'SESSIONS', 'NONUNIQUE', 'NORMAL', 'USER_ID,REVOKED_AT,EXPIRES_AT');
    verify_index('UX_ADDR_ONE_DEFAULT', 'ADDRESSES', 'UNIQUE', 'FUNCTION', '');
    verify_index('IX_ADDRESSES_USER', 'ADDRESSES', 'NONUNIQUE', 'NORMAL', 'USER_ID,STATUS');
    verify_index('IX_ASSET_OWNER', 'FILE_ASSETS', 'NONUNIQUE', 'NORMAL', 'OWNER_USER_ID,CREATED_AT');
    verify_index('IX_ASSET_SCAN', 'FILE_ASSETS', 'NONUNIQUE', 'NORMAL', 'SCAN_STATUS,ACCESS_POLICY');
    verify_index('IX_NOTIF_USER_UNREAD', 'NOTIFICATIONS', 'NONUNIQUE', 'NORMAL', 'USER_ID,READ_AT,CREATED_AT');
    verify_index('IX_DEVICE_USER', 'DEVICE_TOKENS', 'NONUNIQUE', 'NORMAL', 'USER_ID,REVOKED_AT');
    verify_index('IX_AUDIT_ENTITY', 'AUDIT_EVENTS', 'NONUNIQUE', 'NORMAL', 'ENTITY_TYPE,ENTITY_ID,HAPPENED_AT');
    verify_index('IX_AUDIT_ACTOR', 'AUDIT_EVENTS', 'NONUNIQUE', 'NORMAL', 'ACTOR_USER_ID,HAPPENED_AT');
    verify_index('IX_ADOPT_PUBLIC', 'ADOPTION_LISTINGS', 'NONUNIQUE', 'NORMAL', 'STATUS,POSTED_AT');
    verify_index('IX_ADOPT_CREATOR', 'ADOPTION_LISTINGS', 'NONUNIQUE', 'NORMAL', 'CREATOR_ID,CREATED_AT');
    verify_index('IX_ADOPT_PET', 'ADOPTION_LISTINGS', 'NONUNIQUE', 'NORMAL', 'PET_ID,STATUS');
    verify_index('UX_ADOPT_OPEN_PET', 'ADOPTION_LISTINGS', 'UNIQUE', 'FUNCTION', '');
    verify_index('IX_ADOPT_REVIEWER', 'ADOPTION_LISTINGS', 'NONUNIQUE', 'NORMAL', 'REVIEWED_BY_USER_ID');
    verify_index('IX_ADOPT_MEDIA_FILE', 'ADOPTION_MEDIA', 'NONUNIQUE', 'NORMAL', 'FILE_ID');
    verify_index('UX_ADOPT_APP_ACTIVE', 'ADOPTION_APPLICATIONS', 'UNIQUE', 'FUNCTION', '');
    verify_index('IX_ADOPT_APP_USER', 'ADOPTION_APPLICATIONS', 'NONUNIQUE', 'NORMAL', 'APPLICANT_ID,SUBMITTED_AT');
    verify_index('IX_ADOPT_APP_REVIEWER', 'ADOPTION_APPLICATIONS', 'NONUNIQUE', 'NORMAL', 'REVIEWED_BY_USER_ID');
    verify_index('IX_HANDOVER_PET', 'ADOPTION_HANDOVERS', 'NONUNIQUE', 'NORMAL', 'PET_ID');
    verify_index('IX_HANDOVER_PRIOR', 'ADOPTION_HANDOVERS', 'NONUNIQUE', 'NORMAL', 'PRIOR_OWNER_ID');
    verify_index('IX_HANDOVER_NEW', 'ADOPTION_HANDOVERS', 'NONUNIQUE', 'NORMAL', 'NEW_OWNER_ID');
    verify_index('IX_DONATION_BEN', 'DONATION_CAMPAIGNS', 'NONUNIQUE', 'NORMAL', 'BENEFICIARY_ID,STATUS');
    verify_index('IX_DONATION_PUBLIC', 'DONATION_CAMPAIGNS', 'NONUNIQUE', 'NORMAL', 'STATUS,CREATED_AT');
    verify_index('IX_DONATION_REVIEW', 'DONATION_CAMPAIGNS', 'NONUNIQUE', 'NORMAL', 'REVIEWED_BY_USER_ID');
    verify_index('UX_CONTRIB_PROVIDER_REF', 'DONATION_CONTRIBUTIONS', 'UNIQUE', 'NORMAL', 'PROVIDER_CODE,PROVIDER_REF');
    verify_index('IX_CONTRIB_CAMPAIGN', 'DONATION_CONTRIBUTIONS', 'NONUNIQUE', 'NORMAL', 'CAMPAIGN_ID,CREATED_AT');
    verify_index('IX_CONTRIB_DONOR', 'DONATION_CONTRIBUTIONS', 'NONUNIQUE', 'NORMAL', 'DONOR_ID,CREATED_AT');
    verify_index('IX_SALE_PUBLIC', 'PET_SALE_LISTINGS', 'NONUNIQUE', 'NORMAL', 'STATUS,POSTED_AT');
    verify_index('IX_SALE_SELLER', 'PET_SALE_LISTINGS', 'NONUNIQUE', 'NORMAL', 'SELLER_ID,STATUS');
    verify_index('IX_SALE_PET', 'PET_SALE_LISTINGS', 'NONUNIQUE', 'NORMAL', 'PET_ID,STATUS');
    verify_index('IX_SALE_EVIDENCE', 'PET_SALE_LISTINGS', 'NONUNIQUE', 'NORMAL', 'WELFARE_EVIDENCE_FILE_ID');
    verify_index('IX_SALE_REVIEWER', 'PET_SALE_LISTINGS', 'NONUNIQUE', 'NORMAL', 'REVIEWED_BY_USER_ID');
    verify_index('UX_SALE_OPEN_PET', 'PET_SALE_LISTINGS', 'UNIQUE', 'FUNCTION', '');
    verify_index('IX_SALE_MEDIA_FILE', 'PET_SALE_MEDIA', 'NONUNIQUE', 'NORMAL', 'FILE_ID');
    verify_index('IX_SALE_INQ_LISTING', 'PET_SALE_INQUIRIES', 'NONUNIQUE', 'NORMAL', 'SALE_LISTING_ID,CREATED_AT');
    verify_index('IX_SALE_INQ_BUYER', 'PET_SALE_INQUIRIES', 'NONUNIQUE', 'NORMAL', 'BUYER_ID,CREATED_AT');
    verify_index('IX_SALE_TXN_PET', 'PET_SALE_TRANSACTIONS', 'NONUNIQUE', 'NORMAL', 'PET_ID');
    verify_index('IX_SALE_TXN_BUYER', 'PET_SALE_TRANSACTIONS', 'NONUNIQUE', 'NORMAL', 'BUYER_ID,CREATED_AT');
    verify_index('IX_SALE_TXN_SELLER', 'PET_SALE_TRANSACTIONS', 'NONUNIQUE', 'NORMAL', 'SELLER_ID');
    verify_index('IX_REPORT_REVIEW', 'LISTING_REPORTS', 'NONUNIQUE', 'NORMAL', 'REVIEW_STATE,CREATED_AT');
    verify_index('IX_REPORT_TARGET', 'LISTING_REPORTS', 'NONUNIQUE', 'NORMAL', 'LISTING_TYPE,LISTING_ID');
    verify_index('IX_REPORT_USER', 'LISTING_REPORTS', 'NONUNIQUE', 'NORMAL', 'REPORTER_ID');
    verify_index('IX_REPORT_ASSIGNEE', 'LISTING_REPORTS', 'NONUNIQUE', 'NORMAL', 'ASSIGNED_REVIEWER_ID');
    verify_index('IX_MOD_ACTION_ENTITY', 'MODERATION_ACTIONS', 'NONUNIQUE', 'NORMAL', 'ENTITY_TYPE,ENTITY_ID,HAPPENED_AT');
    verify_index('IX_MOD_ACTOR', 'MODERATION_ACTIONS', 'NONUNIQUE', 'NORMAL', 'ACTOR_USER_ID,HAPPENED_AT');
    verify_index('IX_MOD_REPORT', 'MODERATION_ACTIONS', 'NONUNIQUE', 'NORMAL', 'REPORT_ID');
    verify_index('IX_FAV_TARGET', 'FAVORITES', 'NONUNIQUE', 'NORMAL', 'ENTITY_TYPE,ENTITY_ID');
    verify_index('IX_LOST_PUBLIC', 'LOST_FOUND_POSTS', 'NONUNIQUE', 'NORMAL', 'STATUS,GENERAL_AREA,CREATED_AT');
    verify_index('IX_LOST_POSTER', 'LOST_FOUND_POSTS', 'NONUNIQUE', 'NORMAL', 'POSTER_ID,CREATED_AT');
    verify_index('IX_LOST_PET', 'LOST_FOUND_POSTS', 'NONUNIQUE', 'NORMAL', 'PET_ID');
    verify_index('IX_LOST_REVIEW', 'LOST_FOUND_POSTS', 'NONUNIQUE', 'NORMAL', 'REVIEWED_BY_USER_ID');
    verify_index('IX_LOST_MEDIA_FILE', 'LOST_FOUND_MEDIA', 'NONUNIQUE', 'NORMAL', 'FILE_ID');
    verify_index('IX_SIGHT_POST', 'SIGHTINGS', 'NONUNIQUE', 'NORMAL', 'POST_ID,OBSERVED_AT');
    verify_index('IX_SIGHT_REPORTER', 'SIGHTINGS', 'NONUNIQUE', 'NORMAL', 'REPORTER_ID');
    verify_index('IX_SIGHT_EVIDENCE', 'SIGHTINGS', 'NONUNIQUE', 'NORMAL', 'EVIDENCE_FILE_ID');
    verify_index('UX_REUNION_ACTIVE', 'REUNIFICATION_CLAIMS', 'UNIQUE', 'FUNCTION', '');
    verify_index('UX_REUNION_FINAL', 'REUNIFICATION_CLAIMS', 'UNIQUE', 'FUNCTION', '');
    verify_index('IX_REUNION_POST', 'REUNIFICATION_CLAIMS', 'NONUNIQUE', 'NORMAL', 'POST_ID,STATUS');
    verify_index('IX_REUNION_USER', 'REUNIFICATION_CLAIMS', 'NONUNIQUE', 'NORMAL', 'CLAIMANT_ID');
    verify_index('IX_REUNION_PROOF', 'REUNIFICATION_CLAIMS', 'NONUNIQUE', 'NORMAL', 'PROOF_ASSET_ID');
    verify_index('IX_REUNION_REVIEWER', 'REUNIFICATION_CLAIMS', 'NONUNIQUE', 'NORMAL', 'REVIEWED_BY_USER_ID');
    verify_index('IX_FOOD_CAT_PARENT', 'FOOD_CATEGORIES', 'NONUNIQUE', 'NORMAL', 'PARENT_ID');
    verify_index('IX_FOOD_PROD_SEARCH', 'FOOD_PRODUCTS', 'NONUNIQUE', 'NORMAL', 'CATEGORY_ID,STATUS,TITLE');
    verify_index('IX_PROD_IMG_FILE', 'PRODUCT_IMAGES', 'NONUNIQUE', 'NORMAL', 'FILE_ID');
    verify_index('IX_MOVES_PRODUCT', 'INVENTORY_MOVEMENTS', 'NONUNIQUE', 'NORMAL', 'PRODUCT_ID,CREATED_AT');
    verify_index('IX_MOVES_ACTOR', 'INVENTORY_MOVEMENTS', 'NONUNIQUE', 'NORMAL', 'CREATED_BY_USER_ID');
    verify_index('IX_CART_ITEM_PRODUCT', 'CART_ITEMS', 'NONUNIQUE', 'NORMAL', 'PRODUCT_ID');
    verify_index('IX_ORDER_USER', 'ORDERS', 'NONUNIQUE', 'NORMAL', 'USER_ID,CREATED_AT');
    verify_index('IX_ORDER_STATUS', 'ORDERS', 'NONUNIQUE', 'NORMAL', 'STATUS,CREATED_AT');
    verify_index('IX_ORDER_ADDRESS', 'ORDERS', 'NONUNIQUE', 'NORMAL', 'SHIPPING_ADDRESS_ID');
    verify_index('IX_ORDER_ITEM_PRODUCT', 'ORDER_ITEMS', 'NONUNIQUE', 'NORMAL', 'PRODUCT_ID');
    verify_index('IX_RESERV_EXP', 'ORDER_STOCK_RESERVATIONS', 'NONUNIQUE', 'NORMAL', 'STATE,EXPIRES_AT');
    verify_index('IX_RESERV_PRODUCT', 'ORDER_STOCK_RESERVATIONS', 'NONUNIQUE', 'NORMAL', 'PRODUCT_ID,STATE');
    verify_index('IX_PAY_ORDER', 'PAYMENTS', 'NONUNIQUE', 'NORMAL', 'ORDER_ID,STATE');
    verify_index('IX_PAY_SALE', 'PAYMENTS', 'NONUNIQUE', 'NORMAL', 'SALE_TXN_ID');
    verify_index('IX_PAY_DONATION', 'PAYMENTS', 'NONUNIQUE', 'NORMAL', 'CONTRIBUTION_ID');
    verify_index('IX_PAYMENT_EVENT_PAYMENT', 'PAYMENT_EVENTS', 'NONUNIQUE', 'NORMAL', 'PAYMENT_ID,RECEIVED_AT');
    verify_index('IX_SHIPMENT_ORDER', 'SHIPMENTS', 'NONUNIQUE', 'NORMAL', 'ORDER_ID,STATUS');
    verify_index('IX_SHIPMENT_TRACK', 'SHIPMENTS', 'NONUNIQUE', 'NORMAL', 'CARRIER,TRACKING_REF');
    verify_index('IX_REVIEW_PUBLIC', 'PRODUCT_REVIEWS', 'NONUNIQUE', 'NORMAL', 'PRODUCT_ID,STATUS,CREATED_AT');
    verify_index('IX_REVIEW_BUYER', 'PRODUCT_REVIEWS', 'NONUNIQUE', 'NORMAL', 'BUYER_ID');
    verify_index('IX_REVIEW_MODERATOR', 'PRODUCT_REVIEWS', 'NONUNIQUE', 'NORMAL', 'MODERATED_BY_USER_ID');
    verify_index('IX_OUTBOX_DUE', 'OUTBOX_EVENTS', 'NONUNIQUE', 'NORMAL', 'STATUS,NEXT_ATTEMPT_AT');
    verify_index('IX_OUTBOX_AGG', 'OUTBOX_EVENTS', 'NONUNIQUE', 'NORMAL', 'AGGREGATE_TYPE,AGGREGATE_ID');
    verify_index('IX_IDEMP_EXPIRY', 'IDEMPOTENCY_KEYS', 'NONUNIQUE', 'NORMAL', 'EXPIRES_AT,STATE');
    verify_index('IX_PROFILE_UPDATED', 'USER_PROFILES', 'NONUNIQUE', 'NORMAL', 'UPDATED_AT');
    verify_index('IX_APPT_ACTIVE_VET', 'APPOINTMENTS', 'NONUNIQUE', 'NORMAL', 'STATUS,VET_USER_ID,STARTS_AT');
    verify_index('IX_ADOPT_STATUS_SPECIES', 'ADOPTION_LISTINGS', 'NONUNIQUE', 'NORMAL', 'STATUS,SPECIES');
    verify_index('IX_SALE_STATUS_SPECIES', 'PET_SALE_LISTINGS', 'NONUNIQUE', 'NORMAL', 'STATUS,SPECIES');
    verify_index('IX_LOST_STATUS_SPECIES', 'LOST_FOUND_POSTS', 'NONUNIQUE', 'NORMAL', 'STATUS,SPECIES');
    verify_index('IX_ORDERS_UPDATED', 'ORDERS', 'NONUNIQUE', 'NORMAL', 'UPDATED_AT');

    -- V001-V012 must not have broken PRIMARY KEY / UNIQUE backing indexes.
    FOR r IN (
       SELECT c.constraint_name, c.table_name,
              c.status AS constraint_status, c.validated,
              c.index_name, i.status AS index_status
         FROM USER_CONSTRAINTS c
         LEFT JOIN USER_INDEXES i ON i.index_name = c.index_name
        WHERE c.constraint_type IN ('P','U')
    ) LOOP
        IF r.constraint_status <> 'ENABLED' OR r.validated <> 'VALIDATED'
           OR r.index_name IS NULL OR NVL(r.index_status,'?') <> 'VALID' THEN
            failure('PK/UQ or backing index invalid: ' || r.constraint_name ||
                    ' on ' || r.table_name);
        END IF;
    END LOOP;

    -- Informational, not an error: lack of a left-prefix FK index may
    -- slow joins/parent-row maintenance, but does not violate integrity.
    FOR fk IN (
        SELECT c.constraint_name, c.table_name
          FROM USER_CONSTRAINTS c WHERE c.constraint_type = 'R'
    ) LOOP
        DECLARE
            v_covering PLS_INTEGER;
        BEGIN
            SELECT COUNT(*) INTO v_covering
              FROM USER_INDEXES i
             WHERE i.table_name = fk.table_name
               AND i.status = 'VALID' AND i.visibility = 'VISIBLE'
               AND NOT EXISTS (
                    SELECT 1 FROM USER_CONS_COLUMNS cc
                     WHERE cc.constraint_name = fk.constraint_name
                       AND NOT EXISTS (
                           SELECT 1 FROM USER_IND_COLUMNS ic
                            WHERE ic.index_name = i.index_name
                              AND ic.column_position = cc.position
                              AND ic.column_name = cc.column_name
                       )
               );
            IF v_covering = 0 THEN
                warning('No left-prefix FK index: ' || fk.constraint_name ||
                        ' (' || fk.table_name || ')');
            END IF;
        END;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('Expected explicit indexes: ' || v_expected);
    DBMS_OUTPUT.PUT_LINE('Located explicit indexes:  ' || v_checked);
    DBMS_OUTPUT.PUT_LINE('FK index warnings:         ' || v_warnings);
    DBMS_OUTPUT.PUT_LINE('Failures:                  ' || v_failed);
    IF v_expected <> 109 OR v_failed <> 0 THEN
        RAISE_APPLICATION_ERROR(-20702,
            'PawCare index verification failed; see FAIL lines above.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | Required explicit and PK/unique backing indexes valid.');
    DBMS_OUTPUT.PUT_LINE('NOTE | Expression contents and index selectivity require separate analysis.');
END;
/
