-- ============================================================================
-- PawCare | OWNER dashboard summary (read-only query, not a migration/view)
-- File: database/oracle/queries/dashboard_summary.sql
-- Target: Oracle Database 19c+; schema migrations V001-V012 applied.
--
-- API binds (never interpolate values into SQL):
--   :owner_user_id      NUMBER(19)               -- authenticated caller's ID
--   :as_of_utc          TIMESTAMP WITH TIME ZONE -- current instant in UTC
--   :window_end_utc     TIMESTAMP WITH TIME ZONE -- > as_of_utc; e.g. +7 days
--   :month_start_utc    TIMESTAMP WITH TIME ZONE -- beginning of reporting month
--   :month_end_utc      TIMESTAMP WITH TIME ZONE -- exclusive month boundary
--
-- Backend requirements:
--   * Derive owner_user_id from the validated access token, not client input.
--   * Validate month_start < month_end and as_of < window_end.
--   * Return only to that authenticated owner; apply endpoint rate limits.
--   * Monetary sums are grouped by currency, NEVER added across currencies.
--   * 'monthly_expenses_json' is an array of {currency, amountMinor}; the
--     amountMinor field is a DECIMAL STRING to protect 64-bit precision in JS.
--   * Counts only ACTIVE PETS owned at query time. An adopted-away pet does not
--     remain in this owner's current dashboard/expense totals.
--   * Overdue vaccination uses the latest administered record per
--     (pet_id, vaccine_name); it is a reminder hint, NOT clinical advice.
--   * No data is changed and no database objects are created by this query.
-- ============================================================================

WITH
params AS (
    SELECT :owner_user_id   AS owner_user_id,
           :as_of_utc       AS as_of_utc,
           :window_end_utc  AS window_end_utc,
           :month_start_utc AS month_start_utc,
           :month_end_utc   AS month_end_utc
      FROM DUAL
),
owned_pets AS (
    SELECT pet_id
      FROM PETS p
      JOIN params x ON p.owner_user_id = x.owner_user_id
     WHERE p.status = 'ACTIVE'
),
pet_totals AS (
    SELECT COUNT(*) AS active_pet_count FROM owned_pets
),
care_totals AS (
    SELECT COUNT(CASE WHEN c.due_at <= x.as_of_utc THEN 1 END)
               AS pending_care_due_count,
           COUNT(CASE WHEN c.due_at > x.as_of_utc
                       AND c.due_at < x.window_end_utc THEN 1 END)
               AS upcoming_care_count
      FROM CARE_TASKS c
      JOIN owned_pets op ON op.pet_id = c.pet_id
     CROSS JOIN params x
     WHERE c.status = 'PENDING'
),
latest_vaccinations AS (
    SELECT v.pet_id, v.vaccine_name, v.next_due_at,
           ROW_NUMBER() OVER (
               PARTITION BY v.pet_id, v.vaccine_name
               ORDER BY v.administered_at DESC, v.vaccination_id DESC
           ) AS rn
      FROM VACCINATIONS v
      JOIN owned_pets op ON op.pet_id = v.pet_id
),
vaccine_totals AS (
    SELECT COUNT(CASE WHEN v.next_due_at < x.as_of_utc THEN 1 END)
               AS overdue_vaccination_count,
           COUNT(CASE WHEN v.next_due_at >= x.as_of_utc
                       AND v.next_due_at < x.window_end_utc THEN 1 END)
               AS upcoming_vaccination_count
      FROM latest_vaccinations v
     CROSS JOIN params x
     WHERE v.rn = 1 AND v.next_due_at IS NOT NULL
),
appointment_totals AS (
    SELECT COUNT(*) AS upcoming_appointment_count
      FROM APPOINTMENTS a
      JOIN owned_pets op ON op.pet_id = a.pet_id
     CROSS JOIN params x
     WHERE a.status IN ('REQUESTED', 'CONFIRMED')
       AND a.starts_at >= x.as_of_utc
       AND a.starts_at < x.window_end_utc
),
expense_by_currency AS (
    SELECT e.currency, SUM(e.amount_minor) AS amount_minor
      FROM EXPENSES e
      JOIN owned_pets op ON op.pet_id = e.pet_id
     CROSS JOIN params x
     WHERE e.occurred_at >= x.month_start_utc
       AND e.occurred_at < x.month_end_utc
     GROUP BY e.currency
),
expense_totals AS (
    SELECT NVL(
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'currency'    VALUE e.currency,
                'amountMinor' VALUE TO_CHAR(e.amount_minor, 'TM9')
            ) ORDER BY e.currency RETURNING CLOB
        ),
        TO_CLOB('[]')
    ) AS monthly_expenses_json
      FROM expense_by_currency e
),
notification_totals AS (
    SELECT COUNT(*) AS unread_notification_count
      FROM NOTIFICATIONS n
      JOIN params x ON n.user_id = x.owner_user_id
     WHERE n.read_at IS NULL
),
community_totals AS (
    SELECT
        (SELECT COUNT(*) FROM ADOPTION_LISTINGS a
          WHERE a.creator_id = x.owner_user_id
            AND a.status = 'PUBLISHED') AS published_adoption_count,
        (SELECT COUNT(*) FROM PET_SALE_LISTINGS s
          WHERE s.seller_id = x.owner_user_id
            AND s.status = 'ACTIVE') AS active_pet_sale_count,
        (SELECT COUNT(*) FROM LOST_FOUND_POSTS l
          WHERE l.poster_id = x.owner_user_id
            AND l.status IN ('OPEN', 'VERIFYING')) AS open_lost_found_count
      FROM params x
),
order_totals AS (
    SELECT COUNT(*) AS active_food_order_count
      FROM ORDERS o
      JOIN params x ON o.user_id = x.owner_user_id
     WHERE o.status IN ('PLACED', 'PAID', 'PACKED', 'SHIPPED')
)
SELECT pt.active_pet_count,
       ct.pending_care_due_count,
       ct.upcoming_care_count,
       vt.overdue_vaccination_count,
       vt.upcoming_vaccination_count,
       at.upcoming_appointment_count,
       et.monthly_expenses_json,
       nt.unread_notification_count,
       cm.published_adoption_count,
       cm.active_pet_sale_count,
       cm.open_lost_found_count,
       ot.active_food_order_count
  FROM pet_totals pt
 CROSS JOIN care_totals ct
 CROSS JOIN vaccine_totals vt
 CROSS JOIN appointment_totals at
 CROSS JOIN expense_totals et
 CROSS JOIN notification_totals nt
 CROSS JOIN community_totals cm
 CROSS JOIN order_totals ot;
