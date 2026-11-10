-- ============================================================================
-- PawCare | Oracle seed 002: LOCAL DEVELOPMENT DEMO DATA ONLY
-- Path: database/oracle/seeds/002_demo_data_dev_only.sql
-- Oracle 19c+; SQL*Plus / SQLcl; run as PAWCARE_APP after V001-V012 + seed 001.
--
-- WARNING: NEVER EXECUTE AGAINST STAGING/PRODUCTION OR REAL USER DATA.
-- Creates fictional identities, records and demo listings. Explicit operator
-- confirmation and common local-dev PDB-name allowlist reduce mistakes but
-- CANNOT prove a DB is non-production. VERIFY the connection independently.
--
-- Safety:
--   * ALL accounts use an invalid password-hash marker and cannot log in using
--     a properly implemented password verifier. For interactive testing,
--     register separate dev accounts through the API instead.
--   * No live tokens, credentials, genuine personal details, attachments,
--     captured payments, veterinary dosages, or completed animal transfers.
--   * Adoption/sale/lost posts and donations are DRAFT (not public/live).
--   * Demo food SKUs are fictional; placed demo order is NOT paid or shipped.
--   * Insert-only/idempotent on chosen fixture keys; no DROP/DELETE/updates
--     to existing data, except a matching inventory reservation increment
--     for the newly inserted demo order.
--   * Single data transaction; SQL errors roll back all changes.
-- ============================================================================
SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET DEFINE ON
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT =============================================================
PROMPT WARNING: PawCare DEMO SEED. NEVER run on staging/production.
PROMPT Verify that you are connected to a disposable local DEV PDB.
PROMPT Allowed PDBs: FREEPDB1, XEPDB1, PAWCARE_DEV, DEV_*, *_DEV.
PROMPT =============================================================
ACCEPT PAWCARE_DEMO_ACK CHAR PROMPT 'Type I_CONFIRM_LOCAL_DEV_ONLY to continue: '

DECLARE
    v_pdb VARCHAR2(128) := UPPER(SYS_CONTEXT('USERENV','CON_NAME'));
    v_count NUMBER;
BEGIN
    IF '&&PAWCARE_DEMO_ACK' <> 'I_CONFIRM_LOCAL_DEV_ONLY' THEN
        RAISE_APPLICATION_ERROR(-20601, 'Operator confirmation failed.');
    END IF;
    IF SYS_CONTEXT('USERENV','SESSION_USER') <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
        RAISE_APPLICATION_ERROR(-20602, 'Only PAWCARE_APP may run this seed.');
    END IF;
    IF v_pdb NOT IN ('FREEPDB1','XEPDB1','PAWCARE_DEV')
       AND NOT REGEXP_LIKE(v_pdb, '(^DEV_|_DEV$)') THEN
        RAISE_APPLICATION_ERROR(-20603,
            'PDB is not an approved local development PDB. Stop.');
    END IF;
    SELECT COUNT(*) INTO v_count FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN (
       'V001','V002','V003','V004','V005','V006',
       'V007','V008','V009','V010','V011','V012');
    IF v_count <> 12 THEN
        RAISE_APPLICATION_ERROR(-20604, 'Apply V001-V012 before demo seeding.');
    END IF;
    SELECT COUNT(*) INTO v_count FROM FOOD_CATEGORIES
     WHERE slug IN ('dog-food','cat-food','bird-food','fish-food');
    IF v_count <> 4 THEN
        RAISE_APPLICATION_ERROR(-20605, 'Apply 001_reference_data.sql first.');
    END IF;
    -- Never use an existing real account that somehow has a reserved demo email.
    SELECT COUNT(*) INTO v_count FROM USERS
     WHERE email IN (
       'owner.alex@pawcare-demo.test', 'owner.maya@pawcare-demo.test',
       'vet.sam@pawcare-demo.test', 'admin.ops@pawcare-demo.test')
       AND password_hash <> '!PAWCARE_DEMO_LOGIN_DISABLED!';
    IF v_count <> 0 THEN
        RAISE_APPLICATION_ERROR(-20606,
           'Demo email collision with non-demo account; no changes applied.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('Development-only preflight passed for ' || v_pdb || '.');
END;
/
UNDEFINE PAWCARE_DEMO_ACK
SET DEFINE OFF

DECLARE
    c_fixture CONSTANT VARCHAR2(32) := 'pawcare-demo-002';
    c_hash CONSTANT VARCHAR2(64) := '!PAWCARE_DEMO_LOGIN_DISABLED!';
    v_alex USERS.user_id%TYPE;
    v_maya USERS.user_id%TYPE;
    v_vet USERS.user_id%TYPE;
    v_admin USERS.user_id%TYPE;
    v_buddy PETS.pet_id%TYPE;
    v_luna PETS.pet_id%TYPE;
    v_milo PETS.pet_id%TYPE;
    v_coco PETS.pet_id%TYPE;
    v_dog FOOD_PRODUCTS.product_id%TYPE;
    v_cat FOOD_PRODUCTS.product_id%TYPE;
    v_bird FOOD_PRODUCTS.product_id%TYPE;
    v_address ADDRESSES.address_id%TYPE;
    v_cart CARTS.cart_id%TYPE;
    v_order ORDERS.order_id%TYPE;
    v_is_new PLS_INTEGER := 0;

    PROCEDURE ensure_user(p_email IN VARCHAR2, p_name IN VARCHAR2,
                          p_role IN VARCHAR2, p_id OUT NUMBER) IS
    BEGIN
        INSERT INTO USERS (email, password_hash, role, status, email_verified_at)
        SELECT p_email, c_hash, p_role, 'ACTIVE', SYSTIMESTAMP FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM USERS WHERE email = p_email);
        SELECT user_id INTO p_id FROM USERS WHERE email = p_email;
        INSERT INTO USER_PROFILES (user_id, display_name, preferred_time_zone)
        SELECT p_id, p_name, 'Asia/Dhaka' FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM USER_PROFILES WHERE user_id = p_id);
    END;

    PROCEDURE ensure_pet(p_owner IN NUMBER, p_name IN VARCHAR2,
                         p_species IN VARCHAR2, p_breed IN VARCHAR2,
                         p_id OUT NUMBER) IS
    BEGIN
        INSERT INTO PETS (owner_user_id, name, species, breed, sex,
                          attributes_json, status)
        SELECT p_owner, p_name, p_species, p_breed, 'UNKNOWN',
               '{"fixture":"pawcare-demo-002"}', 'ACTIVE' FROM DUAL
         WHERE NOT EXISTS (
            SELECT 1 FROM PETS WHERE owner_user_id = p_owner AND name = p_name
              AND attributes_json = '{"fixture":"pawcare-demo-002"}');
        SELECT pet_id INTO p_id FROM PETS
         WHERE owner_user_id = p_owner AND name = p_name
           AND attributes_json = '{"fixture":"pawcare-demo-002"}';
    END;

    PROCEDURE ensure_food(p_sku IN VARCHAR2, p_slug IN VARCHAR2,
                          p_title IN VARCHAR2, p_species IN VARCHAR2,
                          p_weight IN NUMBER, p_price IN NUMBER,
                          p_id OUT NUMBER) IS
        v_cat_id FOOD_CATEGORIES.category_id%TYPE;
    BEGIN
        SELECT category_id INTO v_cat_id FROM FOOD_CATEGORIES WHERE slug = p_slug;
        INSERT INTO FOOD_PRODUCTS (category_id,sku,brand,title,description,
                     target_species,net_weight_grams,price_minor,currency,status)
        SELECT v_cat_id,p_sku,'PawCare Demo',p_title,
             'FICTIONAL DEMO PRODUCT - local testing only; not for sale.',
             p_species,p_weight,p_price,'BDT','ACTIVE' FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM FOOD_PRODUCTS WHERE sku = p_sku);
        SELECT product_id INTO p_id FROM FOOD_PRODUCTS WHERE sku = p_sku;
    END;

    PROCEDURE ensure_stock(p_id IN NUMBER, p_key IN VARCHAR2,
                           p_quantity IN NUMBER) IS
        v_inserted NUMBER;
    BEGIN
        INSERT INTO INVENTORY_STOCK (product_id,on_hand_qty,reserved_qty)
        SELECT p_id,p_quantity,0 FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM INVENTORY_STOCK WHERE product_id = p_id);
        v_inserted := SQL%ROWCOUNT;
        IF v_inserted = 1 THEN
            INSERT INTO INVENTORY_MOVEMENTS
                (product_id,quantity_delta,reason,reference_type,reference_id,
                 movement_key,created_by_user_id)
            VALUES (p_id,p_quantity,'RESTOCK','DEV_SEED',c_fixture,
                    p_key,v_admin);
        END IF;
    END;
BEGIN
    -- Users are fictional. No API-valid password hash or login token is made.
    ensure_user('owner.alex@pawcare-demo.test', 'Demo Alex (Owner)', 'OWNER', v_alex);
    ensure_user('owner.maya@pawcare-demo.test', 'Demo Maya (Owner)', 'OWNER', v_maya);
    ensure_user('vet.sam@pawcare-demo.test', 'Demo Sam (Vet)', 'VET', v_vet);
    ensure_user('admin.ops@pawcare-demo.test', 'Demo Operations (Admin)', 'ADMIN', v_admin);

    -- Demo seller capability; not a substitute for real-world verification.
    INSERT INTO USER_CAPABILITIES
      (user_id,capability,status,granted_by_user_id,reason_code)
    SELECT v_maya,'APPROVED_SELLER','ACTIVE',v_admin,'DEV_FIXTURE' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM USER_CAPABILITIES
        WHERE user_id=v_maya AND capability='APPROVED_SELLER' AND status='ACTIVE');

    -- Private, intentionally non-deliverable test address.
    INSERT INTO ADDRESSES
      (user_id,recipient_name,line_1,city,region,country_code,scope,is_default)
    SELECT v_alex,'DEMO RECIPIENT','FICTIONAL - DO NOT DELIVER','Dhaka',
           'Dhaka','BD','SHIPPING',0 FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM ADDRESSES
        WHERE user_id=v_alex AND line_1='FICTIONAL - DO NOT DELIVER');
    SELECT address_id INTO v_address FROM ADDRESSES
     WHERE user_id=v_alex AND line_1='FICTIONAL - DO NOT DELIVER';

    ensure_pet(v_alex,'Demo Buddy','DOG','Golden Retriever',v_buddy);
    ensure_pet(v_alex,'Demo Luna','CAT','Domestic Short Hair',v_luna);
    ensure_pet(v_maya,'Demo Milo','CAT','Domestic Short Hair',v_milo);
    ensure_pet(v_maya,'Demo Coco','BIRD','Budgerigar',v_coco);

    -- Care features: illustrative records, never actual veterinary advice.
    INSERT INTO VACCINATIONS
      (pet_id,vaccine_name,administered_at,next_due_at,
       veterinarian_user_id,recorded_by_user_id,notes)
    SELECT v_buddy,'DEMO - sample vaccination',
           SYSTIMESTAMP - INTERVAL '60' DAY,
           SYSTIMESTAMP + INTERVAL '300' DAY,
           v_vet,v_vet,'Synthetic vaccine history; pawcare-demo-002' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM VACCINATIONS
        WHERE pet_id=v_buddy AND notes='Synthetic vaccine history; pawcare-demo-002');

    INSERT INTO MEDICATIONS
      (pet_id,medication_name,dosage_text,instructions,start_at,end_at,
       status,created_by_user_id)
    SELECT v_buddy,'DEMO - treatment plan',
           'DEMO ONLY - NO REAL DOSAGE',
           'Illustrative UI record; do not administer medicine.',
           SYSTIMESTAMP - INTERVAL '1' DAY,
           SYSTIMESTAMP + INTERVAL '5' DAY,'ACTIVE',v_vet FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM MEDICATIONS
        WHERE pet_id=v_buddy AND medication_name='DEMO - treatment plan');

    INSERT INTO CARE_TASKS
      (pet_id,task_type,title,due_at,occurrence_key,status,time_zone,created_by_user_id)
    SELECT v_buddy,'FEEDING','DEMO - feeding reminder',
           SYSTIMESTAMP + INTERVAL '1' DAY,
           'pawcare-demo-002-buddy-feeding','PENDING','Asia/Dhaka',v_alex FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM CARE_TASKS
        WHERE occurrence_key='pawcare-demo-002-buddy-feeding');

    INSERT INTO APPOINTMENTS
      (pet_id,vet_user_id,created_by_user_id,starts_at,ends_at,status,reason)
    SELECT v_buddy,v_vet,v_alex,SYSTIMESTAMP + INTERVAL '3' DAY,
           SYSTIMESTAMP + INTERVAL '3' DAY + INTERVAL '1' HOUR,
           'REQUESTED','DEMO ONLY: wellness consultation' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM APPOINTMENTS
        WHERE pet_id=v_buddy AND reason='DEMO ONLY: wellness consultation');

    INSERT INTO EXPENSES
      (pet_id,amount_minor,currency,category,occurred_at,description,created_by_user_id)
    SELECT v_buddy,259900,'BDT','FOOD',SYSTIMESTAMP - INTERVAL '2' DAY,
           'DEMO ONLY: sample pet food expense; pawcare-demo-002',v_alex FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM EXPENSES
        WHERE pet_id=v_buddy
          AND description='DEMO ONLY: sample pet food expense; pawcare-demo-002');

    INSERT INTO NOTIFICATIONS (user_id,kind,title,body_text,payload_json)
    SELECT v_alex,'CARE_REMINDER','DEMO: care reminder',
           'Synthetic notification for preview only.',
           '{"fixture":"pawcare-demo-002"}' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM NOTIFICATIONS
        WHERE user_id=v_alex AND title='DEMO: care reminder'
          AND payload_json='{"fixture":"pawcare-demo-002"}');

    -- Community listings never bypass approval or expose private locations.
    INSERT INTO ADOPTION_LISTINGS
      (pet_id,creator_id,title,description,species,general_area,status)
    SELECT v_milo,v_maya,'DEMO: Milo adoption draft',
           'Fictional adoption listing for form and review testing.',
           'CAT','Dhaka (demo)','DRAFT' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM ADOPTION_LISTINGS
        WHERE creator_id=v_maya AND title='DEMO: Milo adoption draft');

    INSERT INTO DONATION_CAMPAIGNS
      (beneficiary_id,purpose,title,goal_minor,currency,verification_status,status)
    SELECT v_maya,'Fictional animal welfare campaign; no donations accepted.',
           'DEMO: welfare campaign',500000,'BDT','PENDING','DRAFT' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM DONATION_CAMPAIGNS
        WHERE beneficiary_id=v_maya AND title='DEMO: welfare campaign');

    INSERT INTO PET_SALE_LISTINGS
      (pet_id,seller_id,title,description,species,general_area,
       asking_minor,currency,status)
    SELECT v_coco,v_maya,'DEMO: Coco sale draft',
           'Fictional listing; no live sale, welfare check or handover.',
           'BIRD','Dhaka (demo)',500000,'BDT','DRAFT' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM PET_SALE_LISTINGS
        WHERE seller_id=v_maya AND title='DEMO: Coco sale draft');

    INSERT INTO LOST_FOUND_POSTS
      (pet_id,poster_id,category,species,description,general_area,
       approximate_radius_km,observed_at,status)
    SELECT v_luna,v_alex,'LOST','CAT',
           'DEMO ONLY: fictional missing-pet report.',
           'Dhaka (demo)',2,SYSTIMESTAMP - INTERVAL '5' HOUR,'DRAFT' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM LOST_FOUND_POSTS
        WHERE poster_id=v_alex AND description='DEMO ONLY: fictional missing-pet report.');

    -- Fictional stock-keeping units; prices stored as BDT minor units.
    ensure_food('DEMO-DOG-001','dog-food','DEMO: dog kibble 1 kg','DOG',1000,129900,v_dog);
    ensure_food('DEMO-CAT-001','cat-food','DEMO: cat food 500 g','CAT',500,89900,v_cat);
    ensure_food('DEMO-BIRD-001','bird-food','DEMO: bird seed 250 g','BIRD',250,34900,v_bird);
    ensure_stock(v_dog,'pawcare-demo-002-restock-dog',25);
    ensure_stock(v_cat,'pawcare-demo-002-restock-cat',18);
    ensure_stock(v_bird,'pawcare-demo-002-restock-bird',12);

    INSERT INTO CARTS (user_id)
    SELECT v_alex FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM CARTS WHERE user_id=v_alex);
    SELECT cart_id INTO v_cart FROM CARTS WHERE user_id=v_alex;
    INSERT INTO CART_ITEMS (cart_id,product_id,quantity)
    SELECT v_cart,v_cat,2 FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM CART_ITEMS
        WHERE cart_id=v_cart AND product_id=v_cat);

    -- One coherent UNPAID example order; a stock reservation is created
    -- atomically with its line and reserved_qty adjustment.
    INSERT INTO ORDERS
      (order_number,user_id,shipping_address_id,shipping_address_snapshot,
       subtotal_minor,shipping_minor,tax_minor,discount_minor,total_minor,
       currency,status)
    SELECT 'DEMO-ORDER-0001',v_alex,v_address,
       '{"recipientName":"DEMO RECIPIENT","line1":"FICTIONAL - DO NOT DELIVER","city":"Dhaka","countryCode":"BD"}',
       129900,8000,0,0,137900,'BDT','PLACED' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM ORDERS
        WHERE order_number='DEMO-ORDER-0001');
    v_is_new := SQL%ROWCOUNT;
    SELECT order_id INTO v_order FROM ORDERS
     WHERE order_number='DEMO-ORDER-0001';

    IF v_is_new = 1 THEN
        INSERT INTO ORDER_ITEMS
         (order_id,product_id,sku_snapshot,title_snapshot,quantity,
          unit_price_minor,line_total_minor,currency)
        VALUES (v_order,v_dog,'DEMO-DOG-001','DEMO: dog kibble 1 kg',
                1,129900,129900,'BDT');
        UPDATE INVENTORY_STOCK
           SET reserved_qty = reserved_qty + 1
         WHERE product_id = v_dog AND on_hand_qty - reserved_qty >= 1;
        IF SQL%ROWCOUNT <> 1 THEN
            RAISE_APPLICATION_ERROR(-20610, 'Insufficient demo inventory for order.');
        END IF;
        INSERT INTO ORDER_STOCK_RESERVATIONS
           (order_id,product_id,quantity,state,expires_at)
        VALUES (v_order,v_dog,1,'RESERVED',SYSTIMESTAMP + INTERVAL '1' DAY);
    END IF;

    DBMS_OUTPUT.PUT_LINE('Demo users: 4; pets: 4; food products: 3.');
    DBMS_OUTPUT.PUT_LINE('Demo order is PLACED/UNPAID. No real payments, shipments or handovers.');
    DBMS_OUTPUT.PUT_LINE('Fixture accounts cannot authenticate; register real DEV test users via API.');
END;
/
COMMIT;

PROMPT PawCare | DEV-only demo seed committed. Never run on production.
SELECT 'DEMO USERS' fixture_group, COUNT(*) item_count FROM USERS
 WHERE email LIKE '%@pawcare-demo.test'
UNION ALL
SELECT 'DEMO FOOD PRODUCTS', COUNT(*) FROM FOOD_PRODUCTS
 WHERE sku LIKE 'DEMO-%'
UNION ALL
SELECT 'DEMO ORDERS', COUNT(*) FROM ORDERS
 WHERE order_number='DEMO-ORDER-0001';
