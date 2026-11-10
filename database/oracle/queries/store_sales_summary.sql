-- ============================================================================
-- PawCare | Pet food STORE daily order-sales summary (read-only)
-- File: database/oracle/queries/store_sales_summary.sql
-- Target: Oracle Database 19c+; schema migrations V001-V012 applied.
--
-- API binds:
--   :from_utc    TIMESTAMP WITH TIME ZONE -- inclusive start of period
--   :to_utc      TIMESTAMP WITH TIME ZONE -- exclusive end of period
--
-- Security and accounting scope:
--   * ONLY call from a role/capability-guarded ADMIN or STORE_OPERATOR API.
--     This SQL contains no user ownership filter because the store is central.
--   * Reads only FOOD ORDERS (ORDERS/ORDER_ITEMS), not animal sales/donations.
--   * One row per UTC order-creation day and currency. Zero-order dates are
--     omitted (the API can fill missing days if required).
--   * All values use integer minor units, never floating-point currency.
--     Do not combine sums across currencies without FX conversion.
--   * This report summarizes CURRENT ORDER STATUS, grouped by order-created
--     day. It is NOT a payment settlement, cash-flow, tax, or net revenue
--     report; refunds and captured funds require payment-event reconciliation.
--   * No double counting from ORDER_ITEMS: order money and item units are
--     aggregated independently, then joined by date/currency.
--   * Use a bounded period via the API (for example, <= 366 days per call).
-- ============================================================================

WITH
filtered_orders AS (
    SELECT o.order_id,
           TRUNC(CAST(SYS_EXTRACT_UTC(o.created_at) AS DATE))
               AS report_day_utc,
           o.currency,
           o.status,
           o.subtotal_minor,
           o.shipping_minor,
           o.tax_minor,
           o.discount_minor,
           o.total_minor
      FROM ORDERS o
     WHERE o.created_at >= :from_utc
       AND o.created_at < :to_utc
),
daily_order_totals AS (
    SELECT fo.report_day_utc,
           fo.currency,
           COUNT(*) AS order_count,
           COUNT(CASE WHEN fo.status = 'PLACED' THEN 1 END)
               AS placed_unpaid_count,
           COUNT(CASE WHEN fo.status IN (
               'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'
           ) THEN 1 END) AS paid_fulfillment_order_count,
           COUNT(CASE WHEN fo.status = 'CANCELLED' THEN 1 END)
               AS cancelled_order_count,
           COUNT(CASE WHEN fo.status = 'REFUNDED' THEN 1 END)
               AS refunded_order_count,
           SUM(fo.total_minor) AS all_order_total_minor,
           SUM(CASE WHEN fo.status IN (
               'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'
           ) THEN fo.total_minor ELSE 0 END)
               AS paid_fulfillment_total_minor,
           SUM(CASE WHEN fo.status = 'REFUNDED'
               THEN fo.total_minor ELSE 0 END)
               AS refunded_status_order_total_minor,
           SUM(fo.subtotal_minor) AS subtotal_minor,
           SUM(fo.shipping_minor) AS shipping_minor,
           SUM(fo.tax_minor) AS tax_minor,
           SUM(fo.discount_minor) AS discount_minor
      FROM filtered_orders fo
     GROUP BY fo.report_day_utc, fo.currency
),
daily_item_totals AS (
    SELECT fo.report_day_utc,
           fo.currency,
           SUM(oi.quantity) AS all_order_units,
           SUM(CASE WHEN fo.status IN (
               'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'
           ) THEN oi.quantity ELSE 0 END)
               AS paid_fulfillment_units
      FROM filtered_orders fo
      JOIN ORDER_ITEMS oi ON oi.order_id = fo.order_id
     GROUP BY fo.report_day_utc, fo.currency
)
SELECT TO_CHAR(d.report_day_utc, 'YYYY-MM-DD') AS report_date_utc,
       d.currency,
       d.order_count,
       d.placed_unpaid_count,
       d.paid_fulfillment_order_count,
       d.cancelled_order_count,
       d.refunded_order_count,
       d.all_order_total_minor,
       d.paid_fulfillment_total_minor,
       d.refunded_status_order_total_minor,
       d.subtotal_minor,
       d.shipping_minor,
       d.tax_minor,
       d.discount_minor,
       NVL(i.all_order_units, 0) AS all_order_units,
       NVL(i.paid_fulfillment_units, 0) AS paid_fulfillment_units
  FROM daily_order_totals d
  LEFT JOIN daily_item_totals i
    ON i.report_day_utc = d.report_day_utc
   AND i.currency = d.currency
 ORDER BY d.report_day_utc DESC, d.currency ASC;
