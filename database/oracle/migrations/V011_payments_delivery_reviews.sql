-- ============================================================================
-- PawCare | Oracle migration V011: Payments, shipments and reviews
-- File: database/oracle/migrations/V011_payments_delivery_reviews.sql
-- Compatible target: Oracle Database 19c+ / Oracle Database Free PDB
-- Run with SQL*Plus / SQLcl, connected AS PAWCARE_APP after V010.
-- Dependencies: V001 through V010; execute in strict numeric order.
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

PROMPT PawCare | V011 preflight ...
DECLARE
    v_predecessors NUMBER;
    v_existing NUMBER;
    v_user VARCHAR2(128);
BEGIN
    v_user := SYS_CONTEXT('USERENV', 'SESSION_USER');
    IF v_user <> 'PAWCARE_APP'
       OR SYS_CONTEXT('USERENV','CURRENT_SCHEMA') <> 'PAWCARE_APP' THEN
       RAISE_APPLICATION_ERROR(-20011,
           'V011: connect as PAWCARE_APP in the intended PDB.');
    END IF;
    SELECT COUNT(*) INTO v_predecessors FROM SCHEMA_MIGRATIONS
     WHERE migration_version IN ('V001', 'V002', 'V003', 'V004', 'V005', 'V006', 'V007', 'V008', 'V009', 'V010');
    IF v_predecessors <> 10 THEN
       RAISE_APPLICATION_ERROR(-20011,
           'V011: missing earlier migration(s) in SCHEMA_MIGRATIONS.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V011';
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20011,
           'V011 already applied; never rerun a versioned migration.');
    END IF;
    SELECT COUNT(*) INTO v_existing FROM USER_OBJECTS
     WHERE OBJECT_NAME IN ('PAYMENTS', 'PAYMENT_EVENTS', 'SHIPMENTS', 'PRODUCT_REVIEWS')
       AND OBJECT_TYPE IN ('TABLE','VIEW');
    IF v_existing <> 0 THEN
       RAISE_APPLICATION_ERROR(-20011,
           'V011: target objects exist; inspect partial deployment.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('V011: preflight passed.');
END;
/

-- BEGIN V011 DDL (checksum scope starts after this line)

-- Only FOOD ORDER payment is enabled at initial launch.
-- Sale/donation target FKs exist for later legal/provider-approved expansion.
-- Raw PAN, CVV or unverified webhook payloads must never be persisted here.
CREATE TABLE PAYMENTS (
    payment_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    order_id NUMBER(19,0),
    sale_txn_id NUMBER(19,0),
    contribution_id NUMBER(19,0),
    provider_code VARCHAR2(40 BYTE) NOT NULL,
    provider_ref VARCHAR2(160 BYTE),
    amount_minor NUMBER(18,0) NOT NULL,
    currency CHAR(3 BYTE) NOT NULL,
    state VARCHAR2(16 BYTE) DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_PAYMENTS PRIMARY KEY (payment_id),
    CONSTRAINT FK_PAY_ORDER FOREIGN KEY (order_id) REFERENCES ORDERS (order_id),
    CONSTRAINT FK_PAY_SALE FOREIGN KEY (sale_txn_id) REFERENCES PET_SALE_TRANSACTIONS (sale_txn_id),
    CONSTRAINT FK_PAY_DONATION FOREIGN KEY (contribution_id) REFERENCES DONATION_CONTRIBUTIONS (contribution_id),
    CONSTRAINT UQ_PAY_PROVIDER_REF UNIQUE (provider_code,provider_ref),
    CONSTRAINT CK_PAY_ONE_TARGET CHECK (
      (CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN sale_txn_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN contribution_id IS NOT NULL THEN 1 ELSE 0 END) = 1),
    CONSTRAINT CK_PAY_AMOUNT CHECK (amount_minor > 0),
    CONSTRAINT CK_PAY_CURRENCY CHECK (REGEXP_LIKE(currency,'^[A-Z]{3}$')),
    CONSTRAINT CK_PAY_STATE CHECK (state IN ('PENDING','AUTHORIZED','CAPTURED','FAILED','REFUNDED','CANCELLED'))
);
CREATE INDEX IX_PAY_ORDER ON PAYMENTS (order_id,state);
CREATE INDEX IX_PAY_SALE ON PAYMENTS (sale_txn_id);
CREATE INDEX IX_PAY_DONATION ON PAYMENTS (contribution_id);

-- Provider signature validation happens BEFORE any write in the API.
CREATE TABLE PAYMENT_EVENTS (
    payment_event_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    payment_id NUMBER(19,0),
    provider_code VARCHAR2(40 BYTE) NOT NULL,
    provider_event_id VARCHAR2(180 BYTE) NOT NULL,
    event_type VARCHAR2(80 BYTE) NOT NULL,
    event_payload_sha256 CHAR(64 BYTE) NOT NULL,
    outcome VARCHAR2(16 BYTE) NOT NULL,
    received_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    processed_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT PK_PAYMENT_EVENTS PRIMARY KEY (payment_event_id),
    CONSTRAINT FK_PAYMENT_EVENT_PAY FOREIGN KEY (payment_id) REFERENCES PAYMENTS (payment_id),
    CONSTRAINT UQ_PAYMENT_EVENT UNIQUE (provider_code,provider_event_id),
    CONSTRAINT CK_PAY_EVENT_HASH CHECK (REGEXP_LIKE(event_payload_sha256,'^[0-9a-f]{64}$')),
    CONSTRAINT CK_PAY_EVENT_OUTCOME CHECK (outcome IN ('PROCESSED','IGNORED','REJECTED','PENDING'))
);
CREATE INDEX IX_PAYMENT_EVENT_PAYMENT ON PAYMENT_EVENTS (payment_id,received_at);

-- Only FOOD orders are eligible for shipment, not PET_SALE_TRANSACTIONS.
CREATE TABLE SHIPMENTS (
    shipment_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    order_id NUMBER(19,0) NOT NULL,
    carrier VARCHAR2(100 BYTE) NOT NULL,
    tracking_ref VARCHAR2(160 BYTE),
    status VARCHAR2(16 BYTE) DEFAULT 'PREPARING' NOT NULL,
    shipped_at TIMESTAMP(6) WITH TIME ZONE,
    delivered_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_SHIPMENTS PRIMARY KEY (shipment_id),
    CONSTRAINT FK_SHIPMENT_ORDER FOREIGN KEY (order_id) REFERENCES ORDERS (order_id),
    CONSTRAINT CK_SHIPMENT_STATUS CHECK (status IN ('PREPARING','SHIPPED','DELIVERED','RETURNED','CANCELLED')),
    CONSTRAINT CK_SHIPMENT_DATES CHECK (delivered_at IS NULL OR
       (shipped_at IS NOT NULL AND delivered_at >= shipped_at)),
    CONSTRAINT CK_SHIPMENT_COMPLETE CHECK (status <> 'DELIVERED' OR delivered_at IS NOT NULL)
);
CREATE INDEX IX_SHIPMENT_ORDER ON SHIPMENTS (order_id,status);
CREATE INDEX IX_SHIPMENT_TRACK ON SHIPMENTS (carrier,tracking_ref);

-- Verified purchase: the API must check ORDER_ITEMS.product_id, ORDERS.user_id
-- and a PAID/DELIVERED eligible order before accepting a buyer review.
CREATE TABLE PRODUCT_REVIEWS (
    review_id NUMBER(19,0) GENERATED ALWAYS AS IDENTITY,
    product_id NUMBER(19,0) NOT NULL,
    buyer_id NUMBER(19,0) NOT NULL,
    order_item_id NUMBER(19,0) NOT NULL,
    rating NUMBER(1,0) NOT NULL,
    review_text VARCHAR2(3000 BYTE),
    status VARCHAR2(16 BYTE) DEFAULT 'PENDING_REVIEW' NOT NULL,
    moderated_by_user_id NUMBER(19,0),
    moderated_at TIMESTAMP(6) WITH TIME ZONE,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT PK_PRODUCT_REVIEWS PRIMARY KEY (review_id),
    CONSTRAINT FK_REVIEW_PRODUCT FOREIGN KEY (product_id) REFERENCES FOOD_PRODUCTS (product_id),
    CONSTRAINT FK_REVIEW_BUYER FOREIGN KEY (buyer_id) REFERENCES USERS (user_id),
    CONSTRAINT FK_REVIEW_ORDER_ITEM FOREIGN KEY (order_item_id) REFERENCES ORDER_ITEMS (order_item_id),
    CONSTRAINT FK_REVIEW_PURCHASE_PRODUCT FOREIGN KEY (order_item_id,product_id)
       REFERENCES ORDER_ITEMS (order_item_id,product_id),
    CONSTRAINT FK_REVIEW_MODERATOR FOREIGN KEY (moderated_by_user_id) REFERENCES USERS (user_id),
    CONSTRAINT UQ_REVIEW_ORDER_ITEM UNIQUE (order_item_id),
    CONSTRAINT CK_REVIEW_RATING CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT CK_REVIEW_STATUS CHECK (status IN ('PENDING_REVIEW','PUBLISHED','REJECTED','REMOVED')),
    CONSTRAINT CK_REVIEW_PUBLISH CHECK (status <> 'PUBLISHED' OR
       (moderated_by_user_id IS NOT NULL AND moderated_at IS NOT NULL))
);
CREATE INDEX IX_REVIEW_PUBLIC ON PRODUCT_REVIEWS (product_id,status,created_at);
CREATE INDEX IX_REVIEW_BUYER ON PRODUCT_REVIEWS (buyer_id);
CREATE INDEX IX_REVIEW_MODERATOR ON PRODUCT_REVIEWS (moderated_by_user_id);
CREATE OR REPLACE TRIGGER TRG_PAYMENTS_UPD
    BEFORE UPDATE ON PAYMENTS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_SHIPMENTS_UPD
    BEFORE UPDATE ON SHIPMENTS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/
CREATE OR REPLACE TRIGGER TRG_PROD_REVIEWS_UPD
    BEFORE UPDATE ON PRODUCT_REVIEWS FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- END V011 DDL (checksum scope ends before this line)

INSERT INTO SCHEMA_MIGRATIONS
    (migration_version, description, provider, checksum_sha256)
VALUES
    ('V011', 'Payments, shipments and reviews', 'ORACLE',
     '5d999b53639aead0322b657f42190829924022280ea8e82a5f52cfa4da2d82e1');
COMMIT;

PROMPT PawCare | V011 postflight ...
DECLARE
    v_tables NUMBER;
    v_views NUMBER;
    v_version NUMBER;
    v_invalid NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_tables FROM USER_TABLES
     WHERE TABLE_NAME IN ('PAYMENTS', 'PAYMENT_EVENTS', 'SHIPMENTS', 'PRODUCT_REVIEWS');
    SELECT COUNT(*) INTO v_views FROM USER_VIEWS
     WHERE VIEW_NAME IN ('__NO_VIEWS__');
    SELECT COUNT(*) INTO v_version FROM SCHEMA_MIGRATIONS
     WHERE migration_version = 'V011';
    SELECT COUNT(*) INTO v_invalid FROM USER_OBJECTS
     WHERE STATUS <> 'VALID'
       AND OBJECT_TYPE IN ('VIEW','TRIGGER','PROCEDURE','FUNCTION');
    IF v_tables <> 4
       OR v_views <> 0
       OR v_version <> 1 OR v_invalid <> 0 THEN
       RAISE_APPLICATION_ERROR(-20011, 'V011: postflight failed.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('PASS V011: 4 table(s), 0 view(s), migration checksum registered.');
END;
/

PROMPT PawCare | V011 complete.
