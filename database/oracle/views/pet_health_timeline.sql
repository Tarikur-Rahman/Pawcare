-- ============================================================================
-- PawCare | Owner-scoped pet health and care timeline (read-only)
-- File: database/oracle/queries/pet_health_timeline.sql
-- Target: Oracle Database 19c+; schema migrations V001-V012 applied.
--
-- API binds:
--   :requester_user_id NUMBER(19)               -- authenticated owner ID
--   :pet_id            NUMBER(19)               -- selected pet
--   :from_utc          TIMESTAMP WITH TIME ZONE -- inclusive, UTC
--   :to_utc            TIMESTAMP WITH TIME ZONE -- exclusive, UTC
--   :offset_rows       NUMBER                   -- integer >= 0
--   :page_size         NUMBER                   -- integer 1..100
--
-- Privacy/access:
--   * This query is STRICTLY for the current pet owner. It returns no rows
--     for pets not owned by :requester_user_id. Never accept requester_user_id
--     from a client-provided body/query parameter.
--   * Authorized veterinarians require a separate assignment-scoped query.
--   * The API must check pet visibility before interpreting zero rows as
--     an empty timeline; a missing/unowned pet must not be disclosed.
--   * Event rows are derived from source records, not clinical diagnoses.
--   * Medication schedules are NOT expanded into inferred doses.
--   * Every timestamp has a time zone; display in the user's IANA time zone.
--   * Pagination uses a stable event ordering but offset pages can change if
--     new records are inserted. Snapshot/keyset paging can be added later.
--   * No dynamic SQL, mutations, or access to other owners' pet information.
-- ============================================================================

WITH
scoped_pet AS (
    SELECT p.pet_id
      FROM PETS p
     WHERE p.pet_id = :pet_id
       AND p.owner_user_id = :requester_user_id
       AND p.status <> 'ARCHIVED'
),
latest_due_vaccinations AS (
    SELECT v.vaccination_id, v.vaccine_name, v.next_due_at,
           ROW_NUMBER() OVER (
               PARTITION BY v.pet_id, v.vaccine_name
               ORDER BY v.administered_at DESC, v.vaccination_id DESC
           ) AS rn
      FROM VACCINATIONS v
      JOIN scoped_pet sp ON sp.pet_id = v.pet_id
),
raw_events AS (
    -- Actual vaccination event (entered history).
    SELECT v.administered_at AS event_at,
           'VACCINATION_GIVEN' AS event_type,
           'VACCINATIONS' AS source_table,
           v.vaccination_id AS source_id,
           'Vaccination: ' || v.vaccine_name AS title,
           SUBSTR(v.notes, 1, 500) AS details,
           'RECORDED' AS event_status
      FROM VACCINATIONS v
      JOIN scoped_pet sp ON sp.pet_id = v.pet_id
     WHERE v.administered_at >= :from_utc
       AND v.administered_at < :to_utc

    UNION ALL
    -- Latest recorded next-due date per vaccine name. This is a reminder,
    -- not evidence that a dose was given; older booster dates are suppressed.
    SELECT v.next_due_at, 'VACCINATION_DUE', 'VACCINATIONS',
           v.vaccination_id,
           'Vaccine due: ' || v.vaccine_name,
           CAST(NULL AS VARCHAR2(500)), 'SCHEDULED'
      FROM latest_due_vaccinations v
     WHERE v.rn = 1
       AND v.next_due_at IS NOT NULL
       AND v.next_due_at >= :from_utc
       AND v.next_due_at < :to_utc

    UNION ALL
    SELECT m.start_at, 'MEDICATION_START', 'MEDICATIONS',
           m.medication_id, 'Medication: ' || m.medication_name,
           SUBSTR(m.dosage_text, 1, 500), m.status
      FROM MEDICATIONS m
      JOIN scoped_pet sp ON sp.pet_id = m.pet_id
     WHERE m.start_at >= :from_utc
       AND m.start_at < :to_utc

    UNION ALL
    SELECT m.end_at, 'MEDICATION_END', 'MEDICATIONS',
           m.medication_id, 'Medication course ends: ' || m.medication_name,
           CAST(NULL AS VARCHAR2(500)), m.status
      FROM MEDICATIONS m
      JOIN scoped_pet sp ON sp.pet_id = m.pet_id
     WHERE m.end_at IS NOT NULL
       AND m.end_at >= :from_utc
       AND m.end_at < :to_utc

    UNION ALL
    SELECT c.due_at, 'CARE_TASK_DUE', 'CARE_TASKS',
           c.care_task_id, c.title,
           c.task_type, c.status
      FROM CARE_TASKS c
      JOIN scoped_pet sp ON sp.pet_id = c.pet_id
     WHERE c.due_at >= :from_utc
       AND c.due_at < :to_utc

    UNION ALL
    SELECT c.completed_at, 'CARE_TASK_COMPLETED', 'CARE_TASKS',
           c.care_task_id, 'Completed: ' || c.title,
           c.task_type, c.status
      FROM CARE_TASKS c
      JOIN scoped_pet sp ON sp.pet_id = c.pet_id
     WHERE c.status = 'COMPLETED'
       AND c.completed_at >= :from_utc
       AND c.completed_at < :to_utc

    UNION ALL
    SELECT a.starts_at, 'VET_APPOINTMENT', 'APPOINTMENTS',
           a.appointment_id, 'Veterinary appointment',
           SUBSTR(a.reason, 1, 500), a.status
      FROM APPOINTMENTS a
      JOIN scoped_pet sp ON sp.pet_id = a.pet_id
     WHERE a.starts_at >= :from_utc
       AND a.starts_at < :to_utc
),
numbered_events AS (
    SELECT ROW_NUMBER() OVER (
               ORDER BY event_at DESC, event_type ASC,
                        source_table ASC, source_id DESC
           ) AS row_num,
           event_at, event_type, source_table, source_id,
           title, details, event_status
      FROM raw_events
)
SELECT event_at, event_type, source_table, source_id,
       title, details, event_status
  FROM numbered_events
 WHERE row_num > :offset_rows
   AND row_num <= (:offset_rows + :page_size)
 ORDER BY row_num;
