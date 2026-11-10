# PawCare Oracle — Migration Recovery and Rollback Runbook

**Not an automated reverse migration.** Oracle DDL commits implicitly. Reversing object creation can delete real orders, medical history, lost-pet evidence, and payment records, so this project intentionally does **not** distribute `DROP`-based undo scripts.

## 1. Choose the recovery strategy

| Situation | Safe default |
|---|---|
| A migration has not started | Do not run it; keep the existing schema unchanged. |
| Script failed midway during a migration | **Stop**; preserve logs and current objects. Because Oracle DDL auto-commits, the state is partially applied and rerunning the version unchanged is unsafe. Compare object inventory and ledger with an earlier backup, then use a reviewed forward-fix migration or DBA-managed restore. |
| Migration completed but newly deployed API breaks | Roll back the API first if the database change is backward-compatible; do not delete DB objects automatically. |
| Production data changed or corrupted | Escalate to DBA; validate a restorable backup / recover to a separate clone, compare data and plan an authorized restore/reconciliation. A full PDB rollback can discard unrelated writes and needs a data-loss plan. |
| Disposable, isolated local development database | A DBA can re-create **only that verified disposable schema** from scratch, then replay approved migrations and reference seeds. **Never perform this on a shared or production schema.** |

## 2. Mandatory preflight before any attempted rollback

1. Identify **environment, Oracle service/PDB, schema account, release, deployment ID, and current app version**. Confirm `CURRENT_SCHEMA=PAWCARE_APP`; never operate in `CDB$ROOT`.
2. Stop accepting new writes: put affected services into maintenance mode and pause workers, outbox, stock reservations, reminders, payment callbacks, and scheduled jobs via an approved procedure.
3. Capture current schema state with [`preflight_read_only.sql`](preflight_read_only.sql). Save the output, API logs, migration checksums, job status, and recent backups **outside the database**.
4. Confirm a **recent, successfully tested, recoverable backup or protected clone**. Backups are a DBA responsibility and are not created by these SQL files.
5. Document data change window and potential loss (especially money, medical records, handovers). Get change approval and user impact signoff.
6. Plan both a forward-fix option and a restore plan; verify safe handling of secrets, external payments, file objects, emails, and pushed notifications. External side effects cannot simply be undone by reverting a SQL table.

## 3. Dependencies and reverse-review order

**Review in reverse order** when analyzing a later migration. This is **not** a safe `DROP TABLE` instruction. Dependencies cross migration boundaries and historical data must be preserved.

| Reverse review | Database objects introduced | Recovery/data caveat |
|---|---|---|
| `V012` | `OUTBOX_EVENTS`, `IDEMPOTENCY_KEYS`, `PET_LISTING_LOCKS`; views `VW_PUBLIC_ADOPTIONS`, `VW_PUBLIC_PET_SALES`, `VW_PUBLIC_LOST_FOUND`, `VW_PUBLIC_FOOD` | Check queued/outbox work, retry keys, public API projections, and open listing locks; never discard pending events unnoticed. |
| `V011` | `PAYMENTS`, `PAYMENT_EVENTS`, `SHIPMENTS`, `PRODUCT_REVIEWS` | Payments and provider events are financial evidence; do not delete or invent settlement history. Preserve review and shipment records. |
| `V010` | `CARTS`, `CART_ITEMS`, `ORDERS`, `ORDER_ITEMS`, `ORDER_STOCK_RESERVATIONS` | Orders and reservations may hold customer commitments and inventory; reconcile payment state and reserved stock. |
| `V009` | `FOOD_CATEGORIES`, `FOOD_PRODUCTS`, `PRODUCT_IMAGES`, `INVENTORY_STOCK`, `INVENTORY_MOVEMENTS` | Products may be referenced by orders and reviews; preserve SKUs, price history and inventory movements. |
| `V008` | `LOST_FOUND_POSTS`, `LOST_FOUND_MEDIA`, `SIGHTINGS`, `REUNIFICATION_CLAIMS` | Reunification proofs, tips and private identities require strict protection and retention review. |
| `V007` | `LISTING_REPORTS`, `MODERATION_ACTIONS`, `FAVORITES` | Moderation and report history is security evidence; preserve auditability. |
| `V006` | `PET_SALE_LISTINGS`, `PET_SALE_MEDIA`, `PET_SALE_INQUIRIES`, `PET_SALE_TRANSACTIONS` | Animal sale transfer and inquiry data can be legally sensitive; avoid retroactively undoing completed handovers. |
| `V005` | `DONATION_CAMPAIGNS`, `DONATION_CONTRIBUTIONS` | Donation contributions may correspond to external settlement; do not erase payment or donor accountability. |
| `V004` | `ADOPTION_LISTINGS`, `ADOPTION_MEDIA`, `ADOPTION_APPLICATIONS`, `ADOPTION_HANDOVERS` | Adoption handovers represent ownership changes; never reset `PETS.owner_user_id` without vetted compensating workflow. |
| `V003` | `FILE_ASSETS`, `NOTIFICATIONS`, `DEVICE_TOKENS`, `AUDIT_EVENTS` | Uploaded media may exist outside the DB; coordinate object-storage cleanup separately from the schema. |
| `V002` | `USER_PROFILES`, `USER_CAPABILITIES`, `SESSIONS`, `ADDRESSES` | Revoking sessions/capabilities has user impact; preserve identity and access audit trails. |
| `V001` | `SCHEMA_MIGRATIONS`, `USERS`, `PETS`, `VACCINATIONS`, `MEDICATIONS`, `CARE_TASKS`, `APPOINTMENTS`, `EXPENSES` | Foundational care and account data plus migration ledger; full schema restoration is normally required for reversal. |

## 4. Controlled recovery procedure

1. **Freeze:** keep API writes, maintenance workers, callbacks and scheduler jobs stopped or queued according to your incident plan.
2. **Compare:** check `SCHEMA_MIGRATIONS`, `USER_OBJECTS`, `USER_CONSTRAINTS` and table row counts against release records and backup state. Run the read-only preflight.
3. **Recover:** for a failed migration, prefer a reviewed additive **new versioned migration** to repair the partial schema without destroying data. For an authorized restore, follow Oracle DBA-managed recovery using a tested backup/clone and the exact recovery point.
4. **Reconcile external effects:** verify provider payments, outbound messages, storage objects, inventory, orders and adoption/sale handovers separately. Database restoration cannot recall emails or reverse external payment provider captures.
5. **Validate:** run [`verify_after_recovery.sql`](verify_after_recovery.sql); when the schema contains all V001–V012 tables, additionally run `../verification/verify_foreign_keys.sql`, `verify_indexes.sql`, and `verify_seed_consistency.sql` as applicable.
6. **Smoke-test:** verify current backend connection, owner authorization, pet CRUD, booking conflict handling, adopt/sale listing safeguards, checkout idempotency, moderation, and data privacy with a real Oracle integration test environment.
7. **Resume:** start services and workers only after DBA/engineering approval and with close monitoring. Document migration status and incident closure.

## 5. Reference data, demo data, and reversible changes

- Reference seed `001_reference_data.sql` uses insert-if-missing. **Do not delete canonical food categories** if products reference them. Changes should use a reviewed new migration with appropriate referential checks.
- Dev-only demo seed `002_demo_data_dev_only.sql` can be discarded by rebuilding a **dedicated disposable local database from a clean snapshot**. Never try to identify demo data by a broad email or ID pattern on a shared database.
- Application setting changes, read-only query changes, and frontend deployments can usually be reverted independently **if their schema/API compatibility has been checked**.
- Oracle schema `000_create_schema.sql` is not idempotent; it must never be rerun against an existing `PAWCARE_APP` account.

## 6. Acceptance criteria before recovery is called complete

- Intended Oracle PDB/schema verified; logs and snapshots retained; backup recovery plan documented.
- No unapproved lost orders, captured payments, adoption/sale handovers, clinical records, audit entries, or customer notifications.
- `SCHEMA_MIGRATIONS` matches the restored source version and stored checksums; no silent ledger manipulation.
- No unexpected invalid objects, disabled constraints, orphan records, or mismatched reference categories for the restored version.
- API passes role/ownership checks and transaction-level smoke tests; schema dependencies match the deployed API release.

**Prohibited shortcut:** deleting `SCHEMA_MIGRATIONS` rows to make an already-applied script rerun. Versioning records history; deleting the row does not undo earlier DDL.

