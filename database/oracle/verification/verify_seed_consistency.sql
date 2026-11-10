-- ============================================================================
-- PawCare | Oracle database verification
-- Path: database/oracle/verification/verify_seed_consistency.sql
-- Purpose: Check reference categories and optional local-dev demo fixture consistency.
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

-- Expected usage: after seed 001 (all environments); optionally after seed 002
-- in a disposable local-development schema. Does not enable demo data.
-- The demo checks assert the INITIAL fixture state; after editing demo data
-- through the app, rerun this only on a reset/known-baseline database.

PROMPT PawCare | Checking reference data and optional development fixture ...
DECLARE
    v_migrations PLS_INTEGER;
    v_errors PLS_INTEGER := 0;
    v_warn PLS_INTEGER := 0;
    v_count NUMBER;
    v_demo_users NUMBER;
    v_demo_skus NUMBER;
    v_demo_orders NUMBER;
    v_demo_pets NUMBER;
    v_demo_total NUMBER;

    PROCEDURE require_count(p_label IN VARCHAR2,
                            p_actual IN NUMBER,
                            p_expected IN NUMBER) IS
    BEGIN
        IF p_actual <> p_expected THEN
            v_errors := v_errors + 1;
            DBMS_OUTPUT.PUT_LINE('FAIL | ' || p_label || ': expected ' ||
                                 p_expected || ', found ' || p_actual);
        ELSE
            DBMS_OUTPUT.PUT_LINE('PASS | ' || p_label || ' (' || p_actual || ')');
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

    -- Seed 001: exact canonical slugs, without requiring display names or
    -- ACTIVE status to remain unchanged by later legitimate administration.
    SELECT COUNT(*) INTO v_count FROM FOOD_CATEGORIES
     WHERE slug IN ('dog-food','cat-food','bird-food','fish-food',
                    'small-pet-food','pet-treats');
    require_count('Six canonical FOOD_CATEGORIES slugs', v_count, 6);

    SELECT COUNT(*) INTO v_count FROM FOOD_CATEGORIES
     WHERE slug IN ('dog-food','cat-food','bird-food','fish-food',
                    'small-pet-food','pet-treats')
       AND (name IS NULL OR TRIM(name) IS NULL);
    require_count('Canonical category names nonblank', v_count, 0);

    SELECT COUNT(*) INTO v_count FROM FOOD_CATEGORIES
     WHERE slug IN ('dog-food','cat-food','bird-food','fish-food',
                    'small-pet-food','pet-treats') AND status <> 'ACTIVE';
    IF v_count > 0 THEN
        v_warn := v_warn + 1;
        DBMS_OUTPUT.PUT_LINE('WARN | ' || v_count ||
            ' canonical categories are not ACTIVE (may be intentional).');
    END IF;

    -- Determine whether ANY of the known demo fixture identifiers exists.
    SELECT COUNT(*) INTO v_demo_users FROM USERS
     WHERE email IN ('owner.alex@pawcare-demo.test',
                     'owner.maya@pawcare-demo.test',
                     'vet.sam@pawcare-demo.test',
                     'admin.ops@pawcare-demo.test');
    SELECT COUNT(*) INTO v_demo_skus FROM FOOD_PRODUCTS
     WHERE sku IN ('DEMO-DOG-001','DEMO-CAT-001','DEMO-BIRD-001');
    SELECT COUNT(*) INTO v_demo_orders FROM ORDERS
     WHERE order_number = 'DEMO-ORDER-0001';
    SELECT COUNT(*) INTO v_demo_pets FROM PETS
     WHERE attributes_json = '{"fixture":"pawcare-demo-002"}';
    v_demo_total := v_demo_users + v_demo_skus + v_demo_orders + v_demo_pets;

    IF v_demo_total = 0 THEN
        DBMS_OUTPUT.PUT_LINE('SKIP | Demo fixture absent (correct for production).');
    ELSE
        DBMS_OUTPUT.PUT_LINE('INFO | Demo fixture detected: validating baseline.');
        require_count('Four demo users', v_demo_users, 4);
        require_count('Four demo pets', v_demo_pets, 4);
        require_count('Three demo food SKUs', v_demo_skus, 3);
        require_count('One demo order', v_demo_orders, 1);

        SELECT COUNT(*) INTO v_count FROM USERS
         WHERE email IN ('owner.alex@pawcare-demo.test',
                         'owner.maya@pawcare-demo.test',
                         'vet.sam@pawcare-demo.test',
                         'admin.ops@pawcare-demo.test')
           AND password_hash = '!PAWCARE_DEMO_LOGIN_DISABLED!';
        require_count('Demo accounts have disabled-login marker', v_count, 4);

        SELECT COUNT(*) INTO v_count FROM USERS u
         JOIN USER_PROFILES p ON p.user_id = u.user_id
        WHERE u.email IN ('owner.alex@pawcare-demo.test',
                          'owner.maya@pawcare-demo.test',
                          'vet.sam@pawcare-demo.test',
                          'admin.ops@pawcare-demo.test');
        require_count('All demo profiles exist', v_count, 4);

        SELECT COUNT(*) INTO v_count FROM USERS u
         WHERE (u.email='owner.alex@pawcare-demo.test' AND u.role='OWNER')
            OR (u.email='owner.maya@pawcare-demo.test' AND u.role='OWNER')
            OR (u.email='vet.sam@pawcare-demo.test' AND u.role='VET')
            OR (u.email='admin.ops@pawcare-demo.test' AND u.role='ADMIN');
        require_count('Demo role mapping', v_count, 4);

        SELECT COUNT(*) INTO v_count FROM FOOD_PRODUCTS f
         JOIN FOOD_CATEGORIES c ON c.category_id = f.category_id
        WHERE (f.sku='DEMO-DOG-001' AND c.slug='dog-food')
           OR (f.sku='DEMO-CAT-001' AND c.slug='cat-food')
           OR (f.sku='DEMO-BIRD-001' AND c.slug='bird-food');
        require_count('Demo food SKU/category mapping', v_count, 3);

        SELECT COUNT(*) INTO v_count FROM INVENTORY_STOCK s
         JOIN FOOD_PRODUCTS f ON f.product_id=s.product_id
        WHERE f.sku IN ('DEMO-DOG-001','DEMO-CAT-001','DEMO-BIRD-001')
          AND s.on_hand_qty >= s.reserved_qty AND s.reserved_qty >= 0;
        require_count('Three demo inventory rows', v_count, 3);

        SELECT COUNT(*) INTO v_count FROM INVENTORY_MOVEMENTS
         WHERE movement_key IN ('pawcare-demo-002-restock-dog',
                                'pawcare-demo-002-restock-cat',
                                'pawcare-demo-002-restock-bird');
        require_count('Three demo inventory restocks', v_count, 3);

        SELECT COUNT(*) INTO v_count FROM ADOPTION_LISTINGS
         WHERE title='DEMO: Milo adoption draft' AND status='DRAFT';
        require_count('Adoption draft remains nonpublic', v_count, 1);
        SELECT COUNT(*) INTO v_count FROM PET_SALE_LISTINGS
         WHERE title='DEMO: Coco sale draft' AND status='DRAFT';
        require_count('Pet sale draft remains nonpublic', v_count, 1);
        SELECT COUNT(*) INTO v_count FROM LOST_FOUND_POSTS
         WHERE description='DEMO ONLY: fictional missing-pet report.'
           AND status='DRAFT';
        require_count('Lost-pet draft remains nonpublic', v_count, 1);
        SELECT COUNT(*) INTO v_count FROM DONATION_CAMPAIGNS
         WHERE title='DEMO: welfare campaign' AND status='DRAFT';
        require_count('Donation campaign draft remains nonpublic', v_count, 1);

        SELECT COUNT(*) INTO v_count FROM ORDERS o
         JOIN USERS u ON u.user_id = o.user_id
        WHERE o.order_number='DEMO-ORDER-0001'
          AND u.email='owner.alex@pawcare-demo.test'
          AND o.status='PLACED' AND o.currency='BDT'
          AND o.subtotal_minor=129900 AND o.shipping_minor=8000
          AND o.tax_minor=0 AND o.discount_minor=0
          AND o.total_minor=137900;
        require_count('Demo order still PLACED (unpaid)', v_count, 1);

        SELECT COUNT(*) INTO v_count FROM ORDER_ITEMS oi
         JOIN ORDERS o ON o.order_id=oi.order_id
         JOIN FOOD_PRODUCTS f ON f.product_id=oi.product_id
        WHERE o.order_number='DEMO-ORDER-0001'
          AND f.sku='DEMO-DOG-001' AND oi.quantity=1
          AND oi.unit_price_minor=129900 AND oi.line_total_minor=129900;
        require_count('Demo order line / amount', v_count, 1);

        SELECT COUNT(*) INTO v_count FROM ORDER_STOCK_RESERVATIONS sr
         JOIN ORDERS o ON o.order_id=sr.order_id
         JOIN FOOD_PRODUCTS f ON f.product_id=sr.product_id
        WHERE o.order_number='DEMO-ORDER-0001'
          AND f.sku='DEMO-DOG-001' AND sr.quantity=1
          AND sr.state='RESERVED';
        require_count('Demo stock reservation', v_count, 1);

        SELECT COUNT(*) INTO v_count FROM PAYMENTS p
         JOIN ORDERS o ON o.order_id=p.order_id
        WHERE o.order_number='DEMO-ORDER-0001';
        require_count('No payment attempt for demo order', v_count, 0);

        SELECT COUNT(*) INTO v_count FROM SHIPMENTS s
         JOIN ORDERS o ON o.order_id=s.order_id
        WHERE o.order_number='DEMO-ORDER-0001';
        require_count('No shipment for demo order', v_count, 0);
    END IF;

    DBMS_OUTPUT.PUT_LINE('Warnings: ' || v_warn || ' | Failures: ' || v_errors);
    IF v_errors <> 0 THEN
        RAISE_APPLICATION_ERROR(-20703,
            'PawCare seed verification failed; see FAIL lines above.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS | Seed consistency verification complete.');
END;
/
