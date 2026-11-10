-- ============================================================================
-- PawCare | Oracle migration V009: Food catalog and stock ledger
-- File: database/oracle/migrations/V009_food_catalog_inventory.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V008.
-- Dependencies: V001 through V008; execute in strict numeric order.
-- No seed data, DROP, TRUNCATE, or elevation of schema privileges.
-- All monetary values in integer minor units + ISO currency codes.
-- UTC exchange at API edge; database timestamps include time-zone offset.
-- This migration is NOT transactionally atomic: Oracle DDL auto-commits.
-- Stop on failure; inspect a partial deployment before retrying.
-- The SHA-256 below covers exact UTF-8 bytes between the DDL marker lines
-- (not including marker lines); keep deployed versions immutable.
-- ============================================================================

SET ECHO OFF
SET FEEDBACK ON
SET VERIFY OFF
SET DEFINE OFF
SET SERVEROUTPUT ON
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT PawCare | V009 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20009,
           'V009: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007', 'V008');
    IF v_predecessors <> 8 THEN
       RAISE_APPLICATION_ERROR(-20009,
           'V009: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V009';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20009,
           'V009 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('FOOD_CATEGORIES', 'FOOD_PRODUCTS', 'PRODUCT_IMAGES', 'INVENTORY_STOCK', 'INVENTORY_MOVEMENTS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20009,
           'V009: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V009: preflight passed.');
END;
/

-- BEGIN V009 DDL (checksum scope starts after this line)

-- Taxonomy is food-only; no live animal product types are permitted here.
CREATE TABLE FOOD_CATEGORIES (
    category_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    parent_id NUMBER(19,0),
    name VARCHAR2(120 BYTE) NOT NULL,
    slug VARCHAR2(120 BYTE) NOT NULL,
    status VARCHAR2(12 BYTE) DEFAULT 'DRAFT' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_FOOD_CATEGORIES PRIMARY KEY (category_id),
    CONSTRAINT FK_FOOD_CAT_PARENT FOREIGN KEY (parent_id) REFERENCES FOOD_CATEGORIES (category_id),
    CONSTRAINT UQ_FOOD_CAT_SLUG UNIQUE (slug),
    CONSTRAINT CK_FOOD_CAT_STATUS CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    CONSTRAINT CK_FOOD_CAT_SLUG CHECK (REGEXP_LIKE(slug,'^[a-z0-9]+(-[a-z0-9]+)*$')),
    CONSTRAINT CK_FOOD_CAT_SELF CHECK (parent_id IS NULL OR parent_id <> category_id)
);
CREATE INDEX IX_FOOD_CAT_PARENT ON FOOD_CATEGORIES (parent_id);

CREATE TABLE FOOD_PRODUCTS (
    product_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    category_id NUMBER(19,0) NOT NULL,
    sku VARCHAR2(80 BYTE) NOT NULL,
    brand VARCHAR2(160 BYTE),
    title VARCHAR2(240 BYTE) NOT NULL,
    description VARCHAR2(4000 BYTE),
    target_species VARCHAR2(80 BYTE) NOT NULL,
    ingredients_text VARCHAR2(4000 BYTE),
    allergen_text VARCHAR2(2000 BYTE),
    net_weight_grams NUMBER(10,0),
    price_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) DEFAULT 'BDT' NOT NULL,
    status VARCHAR2(16 BYTE) DEFAULT 'DRAFT' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_FOOD_PRODUCTS PRIMARY KEY (product_id),
    CONSTRAINT FK_FOOD_PROD_CAT FOREIGN KEY (category_id) REFERENCES FOOD_CATEGORIES (category_id),
    CONSTRAINT UQ_FOOD_PROD_SKU UNIQUE (sku),
    CONSTRAINT CK_FOOD_PROD_PRICE CHECK (price_minor >= 0),
    CONSTRAINT CK_FOOD_PROD_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$')),
    CONSTRAINT CK_FOOD_PROD_WEIGHT CHECK (net_weight_grams IS NULL OR net_weight_grams > 0),
    CONSTRAINT CK_FOOD_PROD_STATUS CHECK (status IN ('DRAFT','ACTIVE','PAUSED','RECALLED','ARCHIVED'))
);
CREATE INDEX IX_FOOD_PROD_SEARCH ON FOOD_PRODUCTS (category_id,status,title);

CREATE TABLE PRODUCT_IMAGES (
    product_image_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    product_id NUMBER(19,0) NOT NULL,
    file_id NUMBER(19,0) NOT NULL,
    sort_order NUMBER(5,0) DEFAULT 0 NOT NULL,
    CONSTRAINT PK_PRODUCT_IMAGES PRIMARY KEY (product_image_id),
    CONSTRAINT FK_PROD_IMG_PRODUCT FOREIGN KEY (product_id) REFERENCES FOOD_PRODUCTS (product_id),
    CONSTRAINT FK_PROD_IMG_FILE FOREIGN KEY (file_id) REFERENCES FILE_ASSETS (file_id),
    CONSTRAINT UQ_PROD_IMG_FILE UNIQUE (product_id,file_id),
    CONSTRAINT UQ_PROD_IMG_SORT UNIQUE (product_id,sort_order),
    CONSTRAINT CK_PROD_IMG_SORT CHECK (sort_order >= 0)
);
CREATE INDEX IX_PROD_IMG_FILE ON PRODUCT_IMAGES (file_id);

-- Fast availability model. Atomic reservation:
-- UPDATE INVENTORY_STOCK SET reserved_qty=reserved_qty+:n
-- WHERE product_id=:id AND on_hand_qty-reserved_qty >= :n;
-- require SQL%ROWCOUNT=1 in the same transaction as reservation/order rows.
CREATE TABLE INVENTORY_STOCK (
    product_id NUMBER(19,0) NOT NULL,
    on_hand_qty NUMBER(12,0) DEFAULT 0 NOT NULL,
    reserved_qty NUMBER(12,0) DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_INVENTORY_STOCK PRIMARY KEY (product_id),
    CONSTRAINT FK_STOCK_PRODUCT FOREIGN KEY (product_id) REFERENCES FOOD_PRODUCTS (product_id),
    CONSTRAINT CK_STOCK_NONNEG CHECK (on_hand_qty >= 0 AND reserved_qty >= 0),
    CONSTRAINT CK_STOCK_AVAILABLE CHECK (reserved_qty <= on_hand_qty)
);

-- Immutable inventory movements by policy / restricted API credentials.
CREATE TABLE INVENTORY_MOVEMENTS (
    movement_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    product_id NUMBER(19,0) NOT NULL,
    quantity_delta NUMBER(12,0) NOT NULL,
    reason VARCHAR2(20 BYTE) NOT NULL,
    reference_type VARCHAR2(30 BYTE),
    reference_id VARCHAR2(80 BYTE),
    movement_key VARCHAR2(160 BYTE) NOT NULL,
    created_by_user_id NUMBER(19,0),
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_INVENTORY_MOVES PRIMARY KEY (movement_id),
    CONSTRAINT FK_MOVE_PRODUCT FOREIGN KEY (product_id) REFERENCES FOOD_PRODUCTS (product_id),
    CONSTRAINT FK_MOVE_ACTOR FOREIGN KEY (created_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_MOVE_KEY UNIQUE (movement_key),
    CONSTRAINT CK_MOVE_DELTA CHECK (quantity_delta <> 0),
    CONSTRAINT CK_MOVE_REASON CHECK (reason IN ('RESTOCK','ADJUSTMENT','FULFILLMENT','RETURN','WRITE_OFF'))
);
CREATE INDEX IX_MOVES_PRODUCT ON INVENTORY_MOVEMENTS (product_id,created_at);
CREATE INDEX IX_MOVES_ACTOR ON INVENTORY_MOVEMENTS (created_by_user_id);
CREATE OR REPLACE TRIGGER TRG_FOOD_CATS_UPD
    BEFORE UPDATE ON FOOD_CATEGORIES FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_FOOD_PRODUCTS_UPD
    BEFORE UPDATE ON FOOD_PRODUCTS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_INV_STOCK_UPD
    BEFORE UPDATE ON INVENTORY_STOCK FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V009 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V009', 'Food catalog and stock ledger', 'ORACLE',
     '116016b508212beb231ad986ad688cef7b980851193d0c61c747321ef0c00f4a');
COMMIT;

PROMPT PawCare | V009 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('FOOD_CATEGORIES', 'FOOD_PRODUCTS', 'PRODUCT_IMAGES', 'INVENTORY_STOCK', 'INVENTORY_MOVEMENTS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V009';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 5
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20009, 'V009: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V009: 5 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V009 complete.
