-- ============================================================================
-- PawCare | Oracle migration V010: Carts, orders and stock reservations
-- File: database/oracle/migrations/V010_cart_orders.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V009.
-- Dependencies: V001 through V009; execute in strict numeric order.
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

PROMPT PawCare | V010 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20010,
           'V010: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007', 'V008', 'V009');
    IF v_predecessors <> 9 THEN
       RAISE_APPLICATION_ERROR(-20010,
           'V010: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V010';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20010,
           'V010 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('CARTS', 'CART_ITEMS', 'ORDERS', 'ORDER_ITEMS', 'ORDER_STOCK_RESERVATIONS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20010,
           'V010: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V010: preflight passed.');
END;
/

-- BEGIN V010 DDL (checksum scope starts after this line)

CREATE TABLE CARTS (
    cart_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    user_id NUMBER(19,0) NOT NULL,
    cart_version NUMBER(12,0) DEFAULT 1 NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_CARTS PRIMARY KEY (cart_id),
    CONSTRAINT FK_CART_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_CART_USER UNIQUE (user_id),
    CONSTRAINT CK_CART_VERSION CHECK (cart_version > 0)
);

CREATE TABLE CART_ITEMS (
    cart_item_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    cart_id NUMBER(19,0) NOT NULL,
    product_id NUMBER(19,0) NOT NULL,
    quantity NUMBER(9,0) NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_CART_ITEMS PRIMARY KEY (cart_item_id),
    CONSTRAINT FK_CART_ITEM_CART FOREIGN KEY (cart_id) REFERENCES CARTS (cart_id),
    CONSTRAINT FK_CART_ITEM_PRODUCT FOREIGN KEY (product_id) REFERENCES FOOD_PRODUCTS (product_id),
    CONSTRAINT UQ_CART_PRODUCT UNIQUE (cart_id,product_id),
    CONSTRAINT CK_CART_ITEM_QTY CHECK (quantity BETWEEN 1 AND 999)
);
CREATE INDEX IX_CART_ITEM_PRODUCT ON CART_ITEMS (product_id);

-- Address/price snapshots are historical facts and must not be rebuilt from
-- changed product prices or edited user addresses after placing an order.
CREATE TABLE ORDERS (
    order_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    order_number VARCHAR2(48 BYTE) NOT NULL,
    user_id NUMBER(19,0) NOT NULL,
    shipping_address_id NUMBER(19,0),
    shipping_address_snapshot VARCHAR2(4000 BYTE) NOT NULL,
    subtotal_minor NUMBER(18,0) NOT NULL,
    shipping_minor NUMBER(18,0) DEFAULT 0 NOT NULL,
    tax_minor NUMBER(18,0) DEFAULT 0 NOT NULL,
    discount_minor NUMBER(18,0) DEFAULT 0 NOT NULL,
    total_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) NOT NULL,
    status VARCHAR2(16 BYTE) DEFAULT 'PLACED' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_ORDERS PRIMARY KEY (order_id),
    CONSTRAINT UQ_ORDER_NUMBER UNIQUE (order_number),
    CONSTRAINT FK_ORDER_USER FOREIGN KEY (user_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_ORDER_SHIP_ADDR FOREIGN KEY (shipping_address_id) REFERENCES ADDRESSES (address_id),
    CONSTRAINT CK_ORDER_ADDRESS_JSON CHECK (shipping_address_snapshot IS JSON (STRICT)),
    CONSTRAINT CK_ORDER_AMOUNTS CHECK (subtotal_minor >= 0 AND shipping_minor >= 0 AND
       tax_minor >= 0 AND discount_minor >= 0 AND total_minor >= 0),
    CONSTRAINT CK_ORDER_TOTAL CHECK (total_minor=subtotal_minor+shipping_minor+tax_minor-discount_minor),
    CONSTRAINT CK_ORDER_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$')),
    CONSTRAINT CK_ORDER_STATUS CHECK (status IN ('PLACED','PAID','PACKED','SHIPPED','DELIVERED','CANCELLED','REFUNDED'))
);
CREATE INDEX IX_ORDER_USER ON ORDERS (user_id,created_at);
CREATE INDEX IX_ORDER_STATUS ON ORDERS (status,created_at);
CREATE INDEX IX_ORDER_ADDRESS ON ORDERS (shipping_address_id);

CREATE TABLE ORDER_ITEMS (
    order_item_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    order_id NUMBER(19,0) NOT NULL,
    product_id NUMBER(19,0) NOT NULL,
    sku_snapshot VARCHAR2(80 BYTE) NOT NULL,
    title_snapshot VARCHAR2(240 BYTE) NOT NULL,
    quantity NUMBER(9,0) NOT NULL,
    unit_price_minor NUMBER(18,0) NOT NULL,
    line_total_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) NOT NULL,
    CONSTRAINT PK_ORDER_ITEMS PRIMARY KEY (order_item_id),
    CONSTRAINT FK_ORDER_ITEM_ORDER FOREIGN KEY (order_id) REFERENCES ORDERS (order_id),
    CONSTRAINT FK_ORDER_ITEM_PRODUCT FOREIGN KEY (product_id) REFERENCES FOOD_PRODUCTS (product_id),
    CONSTRAINT UQ_ORDER_PRODUCT UNIQUE (order_id,product_id),
    CONSTRAINT CK_ORDER_ITEM_QTY CHECK (quantity BETWEEN 1 AND 999),
    CONSTRAINT CK_ORDER_ITEM_PRICE CHECK (unit_price_minor >= 0 AND line_total_minor >= 0),
    CONSTRAINT CK_ORDER_ITEM_TOTAL CHECK (line_total_minor=unit_price_minor*quantity),
    CONSTRAINT CK_ORDER_ITEM_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$'))
);
ALTER TABLE ORDER_ITEMS ADD CONSTRAINT UQ_ORDER_ITEM_PROD
  UNIQUE (order_item_id,product_id);
CREATE INDEX IX_ORDER_ITEM_PRODUCT ON ORDER_ITEMS (product_id);

-- Must be inserted in same transaction as INVENTORY_STOCK reserved increment.
-- Worker expires reservations and releases stock with row locks.
CREATE TABLE ORDER_STOCK_RESERVATIONS (
    reservation_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    order_id NUMBER(19,0) NOT NULL,
    product_id NUMBER(19,0) NOT NULL,
    quantity NUMBER(9,0) NOT NULL,
    state VARCHAR2(12 BYTE) DEFAULT 'RESERVED' NOT NULL,
    reserved_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_ORDER_RESERVATIONS PRIMARY KEY (reservation_id),
    CONSTRAINT FK_RESERV_ORDER FOREIGN KEY (order_id) REFERENCES ORDERS (order_id),
    CONSTRAINT FK_RESERV_PRODUCT FOREIGN KEY (product_id) REFERENCES INVENTORY_STOCK (product_id),
    CONSTRAINT UQ_RESERV_ORDER_PRODUCT UNIQUE (order_id,product_id),
    CONSTRAINT FK_RESERV_ORDER_LINE FOREIGN KEY (order_id,product_id)
       REFERENCES ORDER_ITEMS (order_id,product_id),
    CONSTRAINT CK_RESERV_QTY CHECK (quantity BETWEEN 1 AND 999),
    CONSTRAINT CK_RESERV_STATE CHECK (state IN ('RESERVED','CONSUMED','RELEASED','EXPIRED')),
    CONSTRAINT CK_RESERV_EXP CHECK (expires_at > reserved_at),
    CONSTRAINT CK_RESERV_CLOSED CHECK ((state='RESERVED' AND closed_at IS NULL) OR
      (state<>'RESERVED' AND closed_at IS NOT NULL))
);
CREATE INDEX IX_RESERV_EXP ON ORDER_STOCK_RESERVATIONS (state,expires_at);
CREATE INDEX IX_RESERV_PRODUCT ON ORDER_STOCK_RESERVATIONS (product_id,state);
CREATE OR REPLACE TRIGGER TRG_CARTS_UPD
    BEFORE UPDATE ON CARTS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_CART_ITEMS_UPD
    BEFORE UPDATE ON CART_ITEMS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_ORDERS_UPD
    BEFORE UPDATE ON ORDERS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V010 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V010', 'Carts, orders and stock reservations', 'ORACLE',
     '3a26977be546b113b575e950147954f618b29a10843c48ec770580aeabf492e9');
COMMIT;

PROMPT PawCare | V010 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('CARTS', 'CART_ITEMS', 'ORDERS', 'ORDER_ITEMS', 'ORDER_STOCK_RESERVATIONS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V010';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 5
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20010, 'V010: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V010: 5 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V010 complete.
