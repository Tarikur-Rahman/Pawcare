using System.Data.Common;
using System.Text.RegularExpressions;
using Oracle.ManagedDataAccess.Client;
using PawCare.Api.Infrastructure.Database;
using Xunit;

namespace PawCare.IntegrationTests;

/// <summary>
/// Oracle-only schema contract tests. The historical name is preserved so the
/// documented project tree remains stable; SQLite parity is NOT tested.
/// Tests neither migrate nor seed nor change database contents.
/// Baselines are derived from the immutable PawCare Oracle V001-V014 files
/// and verify_foreign_keys.sql / verify_indexes.sql scripts.
/// </summary>
public sealed class SqlProviderParityTests
{
    private readonly ApiDatabaseFixture _fixture = new();

    private sealed record ForeignKeySpec(string Name, string ChildTable, string ChildColumns,
        string ParentTable, string ParentColumns);
    private sealed record IndexSpec(string Name, string Table, string Uniqueness,
        string Kind, string Columns, string[]? Expressions = null,
        string? OracleIndexType = null);
    private sealed record IndexColumn(string Name, int Position, string ColumnName,
        string? Expression);

    private static readonly string[] ExpectedTables =
    [
        "SCHEMA_MIGRATIONS",
        "USERS",
        "PETS",
        "VACCINATIONS",
        "MEDICATIONS",
        "CARE_TASKS",
        "APPOINTMENTS",
        "EXPENSES",
        "USER_PROFILES",
        "USER_CAPABILITIES",
        "SESSIONS",
        "ADDRESSES",
        "FILE_ASSETS",
        "NOTIFICATIONS",
        "DEVICE_TOKENS",
        "AUDIT_EVENTS",
        "ADOPTION_LISTINGS",
        "ADOPTION_MEDIA",
        "ADOPTION_APPLICATIONS",
        "ADOPTION_HANDOVERS",
        "DONATION_CAMPAIGNS",
        "DONATION_CONTRIBUTIONS",
        "PET_SALE_LISTINGS",
        "PET_SALE_MEDIA",
        "PET_SALE_INQUIRIES",
        "PET_SALE_TRANSACTIONS",
        "LISTING_REPORTS",
        "MODERATION_ACTIONS",
        "FAVORITES",
        "LOST_FOUND_POSTS",
        "LOST_FOUND_MEDIA",
        "SIGHTINGS",
        "REUNIFICATION_CLAIMS",
        "FOOD_CATEGORIES",
        "FOOD_PRODUCTS",
        "PRODUCT_IMAGES",
        "INVENTORY_STOCK",
        "INVENTORY_MOVEMENTS",
        "CARTS",
        "CART_ITEMS",
        "ORDERS",
        "ORDER_ITEMS",
        "ORDER_STOCK_RESERVATIONS",
        "PAYMENTS",
        "PAYMENT_EVENTS",
        "SHIPMENTS",
        "PRODUCT_REVIEWS",
        "OUTBOX_EVENTS",
        "IDEMPOTENCY_KEYS",
        "PET_LISTING_LOCKS"
        ,"EMAIL_VERIFICATION_TOKENS", "PASSWORD_RESET_TOKENS"
    ];

    private static readonly ForeignKeySpec[] ExpectedForeignKeys =
    [
        new("FK_PETS_OWNER", "PETS", "OWNER_USER_ID", "USERS", "USER_ID"),
        new("FK_VACC_PET", "VACCINATIONS", "PET_ID", "PETS", "PET_ID"),
        new("FK_VACC_VET", "VACCINATIONS", "VETERINARIAN_USER_ID", "USERS", "USER_ID"),
        new("FK_VACC_AUTHOR", "VACCINATIONS", "RECORDED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_MED_PET", "MEDICATIONS", "PET_ID", "PETS", "PET_ID"),
        new("FK_MED_AUTHOR", "MEDICATIONS", "CREATED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_CARE_PET", "CARE_TASKS", "PET_ID", "PETS", "PET_ID"),
        new("FK_CARE_AUTHOR", "CARE_TASKS", "CREATED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_APPT_PET", "APPOINTMENTS", "PET_ID", "PETS", "PET_ID"),
        new("FK_APPT_VET", "APPOINTMENTS", "VET_USER_ID", "USERS", "USER_ID"),
        new("FK_APPT_AUTHOR", "APPOINTMENTS", "CREATED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_EXP_PET", "EXPENSES", "PET_ID", "PETS", "PET_ID"),
        new("FK_EXP_AUTHOR", "EXPENSES", "CREATED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_PROFILE_USER", "USER_PROFILES", "USER_ID", "USERS", "USER_ID"),
        new("FK_CAP_USER", "USER_CAPABILITIES", "USER_ID", "USERS", "USER_ID"),
        new("FK_CAP_GRANTOR", "USER_CAPABILITIES", "GRANTED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_SESSION_USER", "SESSIONS", "USER_ID", "USERS", "USER_ID"),
        new("FK_ADDRESS_USER", "ADDRESSES", "USER_ID", "USERS", "USER_ID"),
        new("FK_FILE_OWNER", "FILE_ASSETS", "OWNER_USER_ID", "USERS", "USER_ID"),
        new("FK_PROFILE_AVATAR", "USER_PROFILES", "AVATAR_FILE_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_NOTIF_USER", "NOTIFICATIONS", "USER_ID", "USERS", "USER_ID"),
        new("FK_DEVICE_USER", "DEVICE_TOKENS", "USER_ID", "USERS", "USER_ID"),
        new("FK_AUDIT_ACTOR", "AUDIT_EVENTS", "ACTOR_USER_ID", "USERS", "USER_ID"),
        new("FK_ADOPT_PET", "ADOPTION_LISTINGS", "PET_ID", "PETS", "PET_ID"),
        new("FK_ADOPT_CREATOR", "ADOPTION_LISTINGS", "CREATOR_ID", "USERS", "USER_ID"),
        new("FK_ADOPT_REVIEWER", "ADOPTION_LISTINGS", "REVIEWED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_ADOPT_MEDIA_LISTING", "ADOPTION_MEDIA", "ADOPTION_ID", "ADOPTION_LISTINGS", "ADOPTION_ID"),
        new("FK_ADOPT_MEDIA_FILE", "ADOPTION_MEDIA", "FILE_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_ADOPT_APP_LISTING", "ADOPTION_APPLICATIONS", "ADOPTION_ID", "ADOPTION_LISTINGS", "ADOPTION_ID"),
        new("FK_ADOPT_APP_USER", "ADOPTION_APPLICATIONS", "APPLICANT_ID", "USERS", "USER_ID"),
        new("FK_ADOPT_APP_REVIEW", "ADOPTION_APPLICATIONS", "REVIEWED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_HANDOVER_LISTING", "ADOPTION_HANDOVERS", "ADOPTION_ID", "ADOPTION_LISTINGS", "ADOPTION_ID"),
        new("FK_HANDOVER_APP", "ADOPTION_HANDOVERS", "APPLICATION_ID", "ADOPTION_APPLICATIONS", "APPLICATION_ID"),
        new("FK_HANDOVER_APP_MATCH", "ADOPTION_HANDOVERS", "ADOPTION_ID,APPLICATION_ID,NEW_OWNER_ID", "ADOPTION_APPLICATIONS", "ADOPTION_ID,APPLICATION_ID,APPLICANT_ID"),
        new("FK_HANDOVER_PET", "ADOPTION_HANDOVERS", "PET_ID", "PETS", "PET_ID"),
        new("FK_HANDOVER_PRIOR", "ADOPTION_HANDOVERS", "PRIOR_OWNER_ID", "USERS", "USER_ID"),
        new("FK_HANDOVER_NEW", "ADOPTION_HANDOVERS", "NEW_OWNER_ID", "USERS", "USER_ID"),
        new("FK_DONATION_BEN", "DONATION_CAMPAIGNS", "BENEFICIARY_ID", "USERS", "USER_ID"),
        new("FK_DONATION_REVIEW", "DONATION_CAMPAIGNS", "REVIEWED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_CONTRIB_CAMPAIGN", "DONATION_CONTRIBUTIONS", "CAMPAIGN_ID", "DONATION_CAMPAIGNS", "CAMPAIGN_ID"),
        new("FK_CONTRIB_DONOR", "DONATION_CONTRIBUTIONS", "DONOR_ID", "USERS", "USER_ID"),
        new("FK_SALE_PET", "PET_SALE_LISTINGS", "PET_ID", "PETS", "PET_ID"),
        new("FK_SALE_SELLER", "PET_SALE_LISTINGS", "SELLER_ID", "USERS", "USER_ID"),
        new("FK_SALE_EVIDENCE", "PET_SALE_LISTINGS", "WELFARE_EVIDENCE_FILE_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_SALE_REVIEWER", "PET_SALE_LISTINGS", "REVIEWED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_SALE_MEDIA_LISTING", "PET_SALE_MEDIA", "SALE_LISTING_ID", "PET_SALE_LISTINGS", "SALE_LISTING_ID"),
        new("FK_SALE_MEDIA_FILE", "PET_SALE_MEDIA", "FILE_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_SALE_INQ_LISTING", "PET_SALE_INQUIRIES", "SALE_LISTING_ID", "PET_SALE_LISTINGS", "SALE_LISTING_ID"),
        new("FK_SALE_INQ_BUYER", "PET_SALE_INQUIRIES", "BUYER_ID", "USERS", "USER_ID"),
        new("FK_SALE_TXN_LISTING", "PET_SALE_TRANSACTIONS", "SALE_LISTING_ID", "PET_SALE_LISTINGS", "SALE_LISTING_ID"),
        new("FK_SALE_TXN_PET", "PET_SALE_TRANSACTIONS", "PET_ID", "PETS", "PET_ID"),
        new("FK_SALE_TXN_SELLER", "PET_SALE_TRANSACTIONS", "SELLER_ID", "USERS", "USER_ID"),
        new("FK_SALE_TXN_BUYER", "PET_SALE_TRANSACTIONS", "BUYER_ID", "USERS", "USER_ID"),
        new("FK_REPORT_USER", "LISTING_REPORTS", "REPORTER_ID", "USERS", "USER_ID"),
        new("FK_REPORT_REVIEWER", "LISTING_REPORTS", "ASSIGNED_REVIEWER_ID", "USERS", "USER_ID"),
        new("FK_MOD_ACTOR", "MODERATION_ACTIONS", "ACTOR_USER_ID", "USERS", "USER_ID"),
        new("FK_MOD_REPORT", "MODERATION_ACTIONS", "REPORT_ID", "LISTING_REPORTS", "REPORT_ID"),
        new("FK_FAV_USER", "FAVORITES", "USER_ID", "USERS", "USER_ID"),
        new("FK_LOST_PET", "LOST_FOUND_POSTS", "PET_ID", "PETS", "PET_ID"),
        new("FK_LOST_POSTER", "LOST_FOUND_POSTS", "POSTER_ID", "USERS", "USER_ID"),
        new("FK_LOST_REVIEW", "LOST_FOUND_POSTS", "REVIEWED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_LOST_MEDIA_POST", "LOST_FOUND_MEDIA", "POST_ID", "LOST_FOUND_POSTS", "POST_ID"),
        new("FK_LOST_MEDIA_FILE", "LOST_FOUND_MEDIA", "FILE_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_SIGHT_POST", "SIGHTINGS", "POST_ID", "LOST_FOUND_POSTS", "POST_ID"),
        new("FK_SIGHT_REPORTER", "SIGHTINGS", "REPORTER_ID", "USERS", "USER_ID"),
        new("FK_SIGHT_EVIDENCE", "SIGHTINGS", "EVIDENCE_FILE_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_REUNION_POST", "REUNIFICATION_CLAIMS", "POST_ID", "LOST_FOUND_POSTS", "POST_ID"),
        new("FK_REUNION_CLAIMANT", "REUNIFICATION_CLAIMS", "CLAIMANT_ID", "USERS", "USER_ID"),
        new("FK_REUNION_PROOF", "REUNIFICATION_CLAIMS", "PROOF_ASSET_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_REUNION_REVIEWER", "REUNIFICATION_CLAIMS", "REVIEWED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_FOOD_CAT_PARENT", "FOOD_CATEGORIES", "PARENT_ID", "FOOD_CATEGORIES", "CATEGORY_ID"),
        new("FK_FOOD_PROD_CAT", "FOOD_PRODUCTS", "CATEGORY_ID", "FOOD_CATEGORIES", "CATEGORY_ID"),
        new("FK_PROD_IMG_PRODUCT", "PRODUCT_IMAGES", "PRODUCT_ID", "FOOD_PRODUCTS", "PRODUCT_ID"),
        new("FK_PROD_IMG_FILE", "PRODUCT_IMAGES", "FILE_ID", "FILE_ASSETS", "FILE_ID"),
        new("FK_STOCK_PRODUCT", "INVENTORY_STOCK", "PRODUCT_ID", "FOOD_PRODUCTS", "PRODUCT_ID"),
        new("FK_MOVE_PRODUCT", "INVENTORY_MOVEMENTS", "PRODUCT_ID", "FOOD_PRODUCTS", "PRODUCT_ID"),
        new("FK_MOVE_ACTOR", "INVENTORY_MOVEMENTS", "CREATED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_CART_USER", "CARTS", "USER_ID", "USERS", "USER_ID"),
        new("FK_CART_ITEM_CART", "CART_ITEMS", "CART_ID", "CARTS", "CART_ID"),
        new("FK_CART_ITEM_PRODUCT", "CART_ITEMS", "PRODUCT_ID", "FOOD_PRODUCTS", "PRODUCT_ID"),
        new("FK_ORDER_USER", "ORDERS", "USER_ID", "USERS", "USER_ID"),
        new("FK_ORDER_SHIP_ADDR", "ORDERS", "SHIPPING_ADDRESS_ID", "ADDRESSES", "ADDRESS_ID"),
        new("FK_ORDER_ITEM_ORDER", "ORDER_ITEMS", "ORDER_ID", "ORDERS", "ORDER_ID"),
        new("FK_ORDER_ITEM_PRODUCT", "ORDER_ITEMS", "PRODUCT_ID", "FOOD_PRODUCTS", "PRODUCT_ID"),
        new("FK_RESERV_ORDER", "ORDER_STOCK_RESERVATIONS", "ORDER_ID", "ORDERS", "ORDER_ID"),
        new("FK_RESERV_PRODUCT", "ORDER_STOCK_RESERVATIONS", "PRODUCT_ID", "INVENTORY_STOCK", "PRODUCT_ID"),
        new("FK_RESERV_ORDER_LINE", "ORDER_STOCK_RESERVATIONS", "ORDER_ID,PRODUCT_ID", "ORDER_ITEMS", "ORDER_ID,PRODUCT_ID"),
        new("FK_PAY_ORDER", "PAYMENTS", "ORDER_ID", "ORDERS", "ORDER_ID"),
        new("FK_PAY_SALE", "PAYMENTS", "SALE_TXN_ID", "PET_SALE_TRANSACTIONS", "SALE_TXN_ID"),
        new("FK_PAY_DONATION", "PAYMENTS", "CONTRIBUTION_ID", "DONATION_CONTRIBUTIONS", "CONTRIBUTION_ID"),
        new("FK_PAYMENT_EVENT_PAY", "PAYMENT_EVENTS", "PAYMENT_ID", "PAYMENTS", "PAYMENT_ID"),
        new("FK_SHIPMENT_ORDER", "SHIPMENTS", "ORDER_ID", "ORDERS", "ORDER_ID"),
        new("FK_REVIEW_PRODUCT", "PRODUCT_REVIEWS", "PRODUCT_ID", "FOOD_PRODUCTS", "PRODUCT_ID"),
        new("FK_REVIEW_BUYER", "PRODUCT_REVIEWS", "BUYER_ID", "USERS", "USER_ID"),
        new("FK_REVIEW_ORDER_ITEM", "PRODUCT_REVIEWS", "ORDER_ITEM_ID", "ORDER_ITEMS", "ORDER_ITEM_ID"),
        new("FK_REVIEW_PURCHASE_PRODUCT", "PRODUCT_REVIEWS", "ORDER_ITEM_ID,PRODUCT_ID", "ORDER_ITEMS", "ORDER_ITEM_ID,PRODUCT_ID"),
        new("FK_REVIEW_MODERATOR", "PRODUCT_REVIEWS", "MODERATED_BY_USER_ID", "USERS", "USER_ID"),
        new("FK_IDEMP_USER", "IDEMPOTENCY_KEYS", "USER_ID", "USERS", "USER_ID"),
        new("FK_LISTING_LOCK_PET", "PET_LISTING_LOCKS", "PET_ID", "PETS", "PET_ID"),
        new("FK_EMAIL_VERIFY_USER", "EMAIL_VERIFICATION_TOKENS", "USER_ID", "USERS", "USER_ID"),
        new("FK_PASSWORD_RESET_USER", "PASSWORD_RESET_TOKENS", "USER_ID", "USERS", "USER_ID")
    ];

    private static readonly IndexSpec[] ExpectedIndexes =
    [
        new("IX_USERS_ROLE_STATUS", "USERS", "NONUNIQUE", "NORMAL", "ROLE,STATUS"),
        new("IX_PETS_OWNER_STATUS", "PETS", "NONUNIQUE", "NORMAL", "OWNER_USER_ID,STATUS"),
        new("IX_VACC_PET_ADMIN", "VACCINATIONS", "NONUNIQUE", "NORMAL", "PET_ID,ADMINISTERED_AT"),
        new("IX_VACC_VET", "VACCINATIONS", "NONUNIQUE", "NORMAL", "VETERINARIAN_USER_ID"),
        new("IX_VACC_AUTHOR", "VACCINATIONS", "NONUNIQUE", "NORMAL", "RECORDED_BY_USER_ID"),
        new("IX_MED_PET_STATUS", "MEDICATIONS", "NONUNIQUE", "NORMAL", "PET_ID,STATUS,START_AT"),
        new("IX_MED_AUTHOR", "MEDICATIONS", "NONUNIQUE", "NORMAL", "CREATED_BY_USER_ID"),
        new("IX_CARE_PET_DUE", "CARE_TASKS", "NONUNIQUE", "NORMAL", "PET_ID,STATUS,DUE_AT"),
        new("IX_CARE_AUTHOR", "CARE_TASKS", "NONUNIQUE", "NORMAL", "CREATED_BY_USER_ID"),
        new("IX_APPT_PET_START", "APPOINTMENTS", "NONUNIQUE", "NORMAL", "PET_ID,STARTS_AT"),
        new("IX_APPT_VET_START", "APPOINTMENTS", "NONUNIQUE", "NORMAL", "VET_USER_ID,STARTS_AT,STATUS"),
        new("IX_APPT_AUTHOR", "APPOINTMENTS", "NONUNIQUE", "NORMAL", "CREATED_BY_USER_ID"),
        new("IX_EXP_PET_OCCUR", "EXPENSES", "NONUNIQUE", "NORMAL", "PET_ID,OCCURRED_AT"),
        new("IX_EXP_AUTHOR", "EXPENSES", "NONUNIQUE", "NORMAL", "CREATED_BY_USER_ID"),
        new("UX_APPT_ACTIVE_VET_START", "APPOINTMENTS", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN vet_user_id END",
                "CASE WHEN status IN ('REQUESTED','CONFIRMED') THEN starts_at END"
            ]),
        new("UX_CAP_ACTIVE", "USER_CAPABILITIES", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN status = 'ACTIVE' THEN user_id END",
                "CASE WHEN status = 'ACTIVE' THEN capability END"
            ]),
        new("IX_CAP_USER", "USER_CAPABILITIES", "NONUNIQUE", "NORMAL", "USER_ID,CAPABILITY,STATUS"),
        new("IX_CAP_GRANTOR", "USER_CAPABILITIES", "NONUNIQUE", "NORMAL", "GRANTED_BY_USER_ID"),
        new("IX_EMAIL_VERIFY_USER", "EMAIL_VERIFICATION_TOKENS", "NONUNIQUE", "NORMAL", "USER_ID,USED_AT,EXPIRES_AT",
            OracleIndexType: "FUNCTION-BASED NORMAL"),
        new("IX_PWD_RESET_USER", "PASSWORD_RESET_TOKENS", "NONUNIQUE", "NORMAL", "USER_ID,CREATED_AT,USED_AT",
            OracleIndexType: "FUNCTION-BASED NORMAL"),
        new("IX_SESSIONS_USER", "SESSIONS", "NONUNIQUE", "NORMAL", "USER_ID,REVOKED_AT,EXPIRES_AT"),
        new("UX_ADDR_ONE_DEFAULT", "ADDRESSES", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN is_default=1 AND status='ACTIVE' THEN user_id END",
                "CASE WHEN is_default=1 AND status='ACTIVE' THEN scope END"
            ]),
        new("IX_ADDRESSES_USER", "ADDRESSES", "NONUNIQUE", "NORMAL", "USER_ID,STATUS"),
        new("IX_ASSET_OWNER", "FILE_ASSETS", "NONUNIQUE", "NORMAL", "OWNER_USER_ID,CREATED_AT"),
        new("IX_ASSET_SCAN", "FILE_ASSETS", "NONUNIQUE", "NORMAL", "SCAN_STATUS,ACCESS_POLICY"),
        new("IX_NOTIF_USER_UNREAD", "NOTIFICATIONS", "NONUNIQUE", "NORMAL", "USER_ID,READ_AT,CREATED_AT"),
        new("IX_DEVICE_USER", "DEVICE_TOKENS", "NONUNIQUE", "NORMAL", "USER_ID,REVOKED_AT"),
        new("IX_AUDIT_ENTITY", "AUDIT_EVENTS", "NONUNIQUE", "NORMAL", "ENTITY_TYPE,ENTITY_ID,HAPPENED_AT"),
        new("IX_AUDIT_ACTOR", "AUDIT_EVENTS", "NONUNIQUE", "NORMAL", "ACTOR_USER_ID,HAPPENED_AT"),
        new("IX_ADOPT_PUBLIC", "ADOPTION_LISTINGS", "NONUNIQUE", "NORMAL", "STATUS,POSTED_AT"),
        new("IX_ADOPT_CREATOR", "ADOPTION_LISTINGS", "NONUNIQUE", "NORMAL", "CREATOR_ID,CREATED_AT"),
        new("IX_ADOPT_PET", "ADOPTION_LISTINGS", "NONUNIQUE", "NORMAL", "PET_ID,STATUS"),
        new("UX_ADOPT_OPEN_PET", "ADOPTION_LISTINGS", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN status IN ('DRAFT','PENDING_REVIEW','PUBLISHED','MATCHED') THEN pet_id END"
            ]),
        new("IX_ADOPT_REVIEWER", "ADOPTION_LISTINGS", "NONUNIQUE", "NORMAL", "REVIEWED_BY_USER_ID"),
        new("IX_ADOPT_MEDIA_FILE", "ADOPTION_MEDIA", "NONUNIQUE", "NORMAL", "FILE_ID"),
        new("UX_ADOPT_APP_ACTIVE", "ADOPTION_APPLICATIONS", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN status IN ('SUBMITTED','IN_REVIEW','ACCEPTED') THEN adoption_id END",
                "CASE WHEN status IN ('SUBMITTED','IN_REVIEW','ACCEPTED') THEN applicant_id END"
            ]),
        new("IX_ADOPT_APP_USER", "ADOPTION_APPLICATIONS", "NONUNIQUE", "NORMAL", "APPLICANT_ID,SUBMITTED_AT"),
        new("IX_ADOPT_APP_REVIEWER", "ADOPTION_APPLICATIONS", "NONUNIQUE", "NORMAL", "REVIEWED_BY_USER_ID"),
        new("IX_HANDOVER_PET", "ADOPTION_HANDOVERS", "NONUNIQUE", "NORMAL", "PET_ID"),
        new("IX_HANDOVER_PRIOR", "ADOPTION_HANDOVERS", "NONUNIQUE", "NORMAL", "PRIOR_OWNER_ID"),
        new("IX_HANDOVER_NEW", "ADOPTION_HANDOVERS", "NONUNIQUE", "NORMAL", "NEW_OWNER_ID"),
        new("IX_DONATION_BEN", "DONATION_CAMPAIGNS", "NONUNIQUE", "NORMAL", "BENEFICIARY_ID,STATUS"),
        new("IX_DONATION_PUBLIC", "DONATION_CAMPAIGNS", "NONUNIQUE", "NORMAL", "STATUS,CREATED_AT"),
        new("IX_DONATION_REVIEW", "DONATION_CAMPAIGNS", "NONUNIQUE", "NORMAL", "REVIEWED_BY_USER_ID"),
        new("UX_CONTRIB_PROVIDER_REF", "DONATION_CONTRIBUTIONS", "UNIQUE", "NORMAL", "PROVIDER_CODE,PROVIDER_REF"),
        new("IX_CONTRIB_CAMPAIGN", "DONATION_CONTRIBUTIONS", "NONUNIQUE", "NORMAL", "CAMPAIGN_ID,CREATED_AT"),
        new("IX_CONTRIB_DONOR", "DONATION_CONTRIBUTIONS", "NONUNIQUE", "NORMAL", "DONOR_ID,CREATED_AT"),
        new("IX_SALE_PUBLIC", "PET_SALE_LISTINGS", "NONUNIQUE", "NORMAL", "STATUS,POSTED_AT"),
        new("IX_SALE_SELLER", "PET_SALE_LISTINGS", "NONUNIQUE", "NORMAL", "SELLER_ID,STATUS"),
        new("IX_SALE_PET", "PET_SALE_LISTINGS", "NONUNIQUE", "NORMAL", "PET_ID,STATUS"),
        new("IX_SALE_EVIDENCE", "PET_SALE_LISTINGS", "NONUNIQUE", "NORMAL", "WELFARE_EVIDENCE_FILE_ID"),
        new("IX_SALE_REVIEWER", "PET_SALE_LISTINGS", "NONUNIQUE", "NORMAL", "REVIEWED_BY_USER_ID"),
        new("UX_SALE_OPEN_PET", "PET_SALE_LISTINGS", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN status IN ('DRAFT','PENDING_REVIEW','ACTIVE','RESERVED') THEN pet_id END"
            ]),
        new("IX_SALE_MEDIA_FILE", "PET_SALE_MEDIA", "NONUNIQUE", "NORMAL", "FILE_ID"),
        new("IX_SALE_INQ_LISTING", "PET_SALE_INQUIRIES", "NONUNIQUE", "NORMAL", "SALE_LISTING_ID,CREATED_AT"),
        new("IX_SALE_INQ_BUYER", "PET_SALE_INQUIRIES", "NONUNIQUE", "NORMAL", "BUYER_ID,CREATED_AT"),
        new("IX_SALE_TXN_PET", "PET_SALE_TRANSACTIONS", "NONUNIQUE", "NORMAL", "PET_ID"),
        new("IX_SALE_TXN_BUYER", "PET_SALE_TRANSACTIONS", "NONUNIQUE", "NORMAL", "BUYER_ID,CREATED_AT"),
        new("IX_SALE_TXN_SELLER", "PET_SALE_TRANSACTIONS", "NONUNIQUE", "NORMAL", "SELLER_ID"),
        new("IX_REPORT_REVIEW", "LISTING_REPORTS", "NONUNIQUE", "NORMAL", "REVIEW_STATE,CREATED_AT"),
        new("IX_REPORT_TARGET", "LISTING_REPORTS", "NONUNIQUE", "NORMAL", "LISTING_TYPE,LISTING_ID"),
        new("IX_REPORT_USER", "LISTING_REPORTS", "NONUNIQUE", "NORMAL", "REPORTER_ID"),
        new("IX_REPORT_ASSIGNEE", "LISTING_REPORTS", "NONUNIQUE", "NORMAL", "ASSIGNED_REVIEWER_ID"),
        new("IX_MOD_ACTION_ENTITY", "MODERATION_ACTIONS", "NONUNIQUE", "NORMAL", "ENTITY_TYPE,ENTITY_ID,HAPPENED_AT"),
        new("IX_MOD_ACTOR", "MODERATION_ACTIONS", "NONUNIQUE", "NORMAL", "ACTOR_USER_ID,HAPPENED_AT"),
        new("IX_MOD_REPORT", "MODERATION_ACTIONS", "NONUNIQUE", "NORMAL", "REPORT_ID"),
        new("IX_FAV_TARGET", "FAVORITES", "NONUNIQUE", "NORMAL", "ENTITY_TYPE,ENTITY_ID"),
        new("IX_LOST_PUBLIC", "LOST_FOUND_POSTS", "NONUNIQUE", "NORMAL", "STATUS,GENERAL_AREA,CREATED_AT"),
        new("IX_LOST_POSTER", "LOST_FOUND_POSTS", "NONUNIQUE", "NORMAL", "POSTER_ID,CREATED_AT"),
        new("IX_LOST_PET", "LOST_FOUND_POSTS", "NONUNIQUE", "NORMAL", "PET_ID"),
        new("IX_LOST_REVIEW", "LOST_FOUND_POSTS", "NONUNIQUE", "NORMAL", "REVIEWED_BY_USER_ID"),
        new("IX_LOST_MEDIA_FILE", "LOST_FOUND_MEDIA", "NONUNIQUE", "NORMAL", "FILE_ID"),
        new("IX_SIGHT_POST", "SIGHTINGS", "NONUNIQUE", "NORMAL", "POST_ID,OBSERVED_AT"),
        new("IX_SIGHT_REPORTER", "SIGHTINGS", "NONUNIQUE", "NORMAL", "REPORTER_ID"),
        new("IX_SIGHT_EVIDENCE", "SIGHTINGS", "NONUNIQUE", "NORMAL", "EVIDENCE_FILE_ID"),
        new("UX_REUNION_ACTIVE", "REUNIFICATION_CLAIMS", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN status IN ('SUBMITTED','VERIFYING','VERIFIED') THEN post_id END",
                "CASE WHEN status IN ('SUBMITTED','VERIFYING','VERIFIED') THEN claimant_id END"
            ]),
        new("UX_REUNION_FINAL", "REUNIFICATION_CLAIMS", "UNIQUE", "FUNCTION", "",
            [
                "CASE WHEN status='REUNITED' THEN post_id END"
            ]),
        new("IX_REUNION_POST", "REUNIFICATION_CLAIMS", "NONUNIQUE", "NORMAL", "POST_ID,STATUS"),
        new("IX_REUNION_USER", "REUNIFICATION_CLAIMS", "NONUNIQUE", "NORMAL", "CLAIMANT_ID"),
        new("IX_REUNION_PROOF", "REUNIFICATION_CLAIMS", "NONUNIQUE", "NORMAL", "PROOF_ASSET_ID"),
        new("IX_REUNION_REVIEWER", "REUNIFICATION_CLAIMS", "NONUNIQUE", "NORMAL", "REVIEWED_BY_USER_ID"),
        new("IX_FOOD_CAT_PARENT", "FOOD_CATEGORIES", "NONUNIQUE", "NORMAL", "PARENT_ID"),
        new("IX_FOOD_PROD_SEARCH", "FOOD_PRODUCTS", "NONUNIQUE", "NORMAL", "CATEGORY_ID,STATUS,TITLE"),
        new("IX_PROD_IMG_FILE", "PRODUCT_IMAGES", "NONUNIQUE", "NORMAL", "FILE_ID"),
        new("IX_MOVES_PRODUCT", "INVENTORY_MOVEMENTS", "NONUNIQUE", "NORMAL", "PRODUCT_ID,CREATED_AT"),
        new("IX_MOVES_ACTOR", "INVENTORY_MOVEMENTS", "NONUNIQUE", "NORMAL", "CREATED_BY_USER_ID"),
        new("IX_CART_ITEM_PRODUCT", "CART_ITEMS", "NONUNIQUE", "NORMAL", "PRODUCT_ID"),
        new("IX_ORDER_USER", "ORDERS", "NONUNIQUE", "NORMAL", "USER_ID,CREATED_AT"),
        new("IX_ORDER_STATUS", "ORDERS", "NONUNIQUE", "NORMAL", "STATUS,CREATED_AT"),
        new("IX_ORDER_ADDRESS", "ORDERS", "NONUNIQUE", "NORMAL", "SHIPPING_ADDRESS_ID"),
        new("IX_ORDER_ITEM_PRODUCT", "ORDER_ITEMS", "NONUNIQUE", "NORMAL", "PRODUCT_ID"),
        new("IX_RESERV_EXP", "ORDER_STOCK_RESERVATIONS", "NONUNIQUE", "NORMAL", "STATE,EXPIRES_AT"),
        new("IX_RESERV_PRODUCT", "ORDER_STOCK_RESERVATIONS", "NONUNIQUE", "NORMAL", "PRODUCT_ID,STATE"),
        new("IX_PAY_ORDER", "PAYMENTS", "NONUNIQUE", "NORMAL", "ORDER_ID,STATE"),
        new("IX_PAY_SALE", "PAYMENTS", "NONUNIQUE", "NORMAL", "SALE_TXN_ID"),
        new("IX_PAY_DONATION", "PAYMENTS", "NONUNIQUE", "NORMAL", "CONTRIBUTION_ID"),
        new("IX_PAYMENT_EVENT_PAYMENT", "PAYMENT_EVENTS", "NONUNIQUE", "NORMAL", "PAYMENT_ID,RECEIVED_AT"),
        new("IX_SHIPMENT_ORDER", "SHIPMENTS", "NONUNIQUE", "NORMAL", "ORDER_ID,STATUS"),
        new("IX_SHIPMENT_TRACK", "SHIPMENTS", "NONUNIQUE", "NORMAL", "CARRIER,TRACKING_REF"),
        new("IX_REVIEW_PUBLIC", "PRODUCT_REVIEWS", "NONUNIQUE", "NORMAL", "PRODUCT_ID,STATUS,CREATED_AT"),
        new("IX_REVIEW_BUYER", "PRODUCT_REVIEWS", "NONUNIQUE", "NORMAL", "BUYER_ID"),
        new("IX_REVIEW_MODERATOR", "PRODUCT_REVIEWS", "NONUNIQUE", "NORMAL", "MODERATED_BY_USER_ID"),
        new("IX_OUTBOX_DUE", "OUTBOX_EVENTS", "NONUNIQUE", "NORMAL", "STATUS,NEXT_ATTEMPT_AT"),
        new("IX_OUTBOX_AGG", "OUTBOX_EVENTS", "NONUNIQUE", "NORMAL", "AGGREGATE_TYPE,AGGREGATE_ID"),
        new("IX_IDEMP_EXPIRY", "IDEMPOTENCY_KEYS", "NONUNIQUE", "NORMAL", "EXPIRES_AT,STATE"),
        new("IX_PROFILE_UPDATED", "USER_PROFILES", "NONUNIQUE", "NORMAL", "UPDATED_AT"),
        new("IX_APPT_ACTIVE_VET", "APPOINTMENTS", "NONUNIQUE", "NORMAL", "STATUS,VET_USER_ID,STARTS_AT"),
        new("IX_ADOPT_STATUS_SPECIES", "ADOPTION_LISTINGS", "NONUNIQUE", "NORMAL", "STATUS,SPECIES"),
        new("IX_SALE_STATUS_SPECIES", "PET_SALE_LISTINGS", "NONUNIQUE", "NORMAL", "STATUS,SPECIES"),
        new("IX_LOST_STATUS_SPECIES", "LOST_FOUND_POSTS", "NONUNIQUE", "NORMAL", "STATUS,SPECIES"),
        new("IX_ORDERS_UPDATED", "ORDERS", "NONUNIQUE", "NORMAL", "UPDATED_AT")
    ];

    private static readonly Dictionary<string, string[]> ExpectedPublicViewColumns = new(StringComparer.Ordinal)
    {
        ["VW_PUBLIC_ADOPTIONS"] = ["ADOPTION_ID", "PET_ID", "TITLE", "SPECIES", "GENERAL_AREA", "POSTED_AT"],
        ["VW_PUBLIC_PET_SALES"] = ["SALE_LISTING_ID", "PET_ID", "TITLE", "SPECIES", "GENERAL_AREA", "ASKING_MINOR", "CURRENCY", "POSTED_AT"],
        ["VW_PUBLIC_LOST_FOUND"] = ["POST_ID", "CATEGORY", "SPECIES", "DESCRIPTION", "GENERAL_AREA", "APPROXIMATE_RADIUS_KM", "OBSERVED_AT", "PUBLISHED_AT"],
        ["VW_PUBLIC_FOOD"] = ["PRODUCT_ID", "CATEGORY_ID", "SKU", "BRAND", "TITLE", "DESCRIPTION", "TARGET_SPECIES", "INGREDIENTS_TEXT", "ALLERGEN_TEXT", "NET_WEIGHT_GRAMS", "PRICE_MINOR", "CURRENCY"],
    };

    // This test always runs. Missing/corrupted migrations fail loudly, even
    // when no Oracle test connection is configured.
    [Fact]
    public async Task LocalOracleMigrationFiles_HaveValidImmutableChecksums()
    {
        var manifest = await MigrationRunner.ReadManifestAsync(ApiDatabaseFixture.MigrationDirectory);
        Assert.Equal(14, manifest.Count);
        for (var i = 0; i < manifest.Count; i++)
        {
            Assert.Equal($"V{i + 1:000}", manifest[i].Version);
            Assert.Equal(64, manifest[i].ChecksumSha256.Length);
            Assert.EndsWith(".sql", manifest[i].FileName, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact(Skip = "Opt in to isolated Oracle schema tests via PAWCARE_TEST_ORACLE_OPT_IN.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task ConnectionTargetsVerifiedTestSchemaAndPdb()
    {
        await using var connection = await _fixture.OpenVerifiedAsync();
        var rows = await ApiDatabaseFixture.SelectAsync(connection,
            "SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') FROM DUAL", ReadSingle);
        Assert.Equal("PAWCARE_APP", Assert.Single(rows));
    }

    [Fact(Skip = "Requires dedicated Oracle test PDB and opt-in.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task AppliedOracleMigrations_ExactlyMatchLocalV001ThroughV014Checksums()
    {
        var manifest = await MigrationRunner.ReadManifestAsync(ApiDatabaseFixture.MigrationDirectory);
        await using var connection = await _fixture.OpenVerifiedAsync();
        var rows = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT migration_version, provider, TRIM(checksum_sha256)
              FROM SCHEMA_MIGRATIONS
             ORDER BY migration_version
            """, r => (Version: Read(r, 0), Provider: Read(r, 1), Hash: Read(r, 2)));

        Assert.Equal(14, rows.Count);
        Assert.Equal(14, rows.Select(x => x.Version).Distinct(StringComparer.Ordinal).Count());
        foreach (var (stored, expected) in rows.Zip(manifest))
        {
            Assert.Equal(expected.Version, stored.Version);
            Assert.Equal("ORACLE", stored.Provider);
            Assert.Equal(expected.ChecksumSha256, stored.Hash);
        }
    }

    [Fact(Skip = "Requires dedicated Oracle test PDB and opt-in.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task CoreAndExtensionTables_MatchTheV001ToV012Baseline()
    {
        await using var connection = await _fixture.OpenVerifiedAsync();
        var actual = await ApiDatabaseFixture.SelectAsync(connection,
            "SELECT table_name FROM USER_TABLES ORDER BY table_name", ReadSingle);
        AssertSameNames("tables", ExpectedTables, actual);
    }

    [Fact(Skip = "Requires dedicated Oracle test PDB and opt-in.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task EveryExpectedForeignKey_HasTheCorrectEndsAndIsEnforced()
    {
        await using var connection = await _fixture.OpenVerifiedAsync();
        var rows = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT c.constraint_name, c.table_name,
                   (SELECT LISTAGG(cc.column_name, ',') WITHIN GROUP (ORDER BY cc.position)
                      FROM USER_CONS_COLUMNS cc
                     WHERE cc.constraint_name = c.constraint_name),
                   p.table_name,
                   (SELECT LISTAGG(pc.column_name, ',') WITHIN GROUP (ORDER BY pc.position)
                      FROM USER_CONS_COLUMNS pc
                     WHERE pc.constraint_name = p.constraint_name),
                   c.status, c.validated, c.delete_rule, c.r_owner, p.constraint_type
              FROM USER_CONSTRAINTS c
              LEFT JOIN USER_CONSTRAINTS p ON p.constraint_name = c.r_constraint_name
             WHERE c.constraint_type = 'R'
            """, r => new
            {
                Name = Read(r, 0), Child = Read(r, 1), ChildCols = Read(r, 2),
                Parent = Read(r, 3), ParentCols = Read(r, 4),
                Status = Read(r, 5), Validated = Read(r, 6),
                DeleteRule = Read(r, 7), ParentOwner = Read(r, 8), ParentType = Read(r, 9)
            });
        AssertSameNames("foreign keys", ExpectedForeignKeys.Select(x => x.Name), rows.Select(x => x.Name));
        var byName = rows.ToDictionary(x => x.Name, StringComparer.Ordinal);
        foreach (var expected in ExpectedForeignKeys)
        {
            var actual = byName[expected.Name];
            Assert.Equal(expected.ChildTable, actual.Child);
            Assert.Equal(expected.ChildColumns, actual.ChildCols);
            Assert.Equal(expected.ParentTable, actual.Parent);
            Assert.Equal(expected.ParentColumns, actual.ParentCols);
            Assert.Equal("ENABLED", actual.Status);
            Assert.Equal("VALIDATED", actual.Validated);
            Assert.Equal("NO ACTION", actual.DeleteRule);
            Assert.Equal("PAWCARE_APP", actual.ParentOwner);
            Assert.Contains(actual.ParentType, new[] { "P", "U" });
        }
    }

    [Fact(Skip = "Requires dedicated Oracle test PDB and opt-in.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task ExplicitV001ToV012Indexes_AreCorrectAndUsable()
    {
        await using var connection = await _fixture.OpenVerifiedAsync();
        var rows = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT i.index_name, i.table_name, i.uniqueness, i.index_type,
                   i.status, i.visibility
              FROM USER_INDEXES i
            """, r => new
            {
                Name = Read(r, 0), Table = Read(r, 1), Uniqueness = Read(r, 2),
                Type = Read(r, 3), Status = Read(r, 4), Visibility = Read(r, 5)
            });
        var indexColumns = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT ic.index_name, ic.column_position, ic.column_name,
                   ie.column_expression
              FROM USER_IND_COLUMNS ic
              LEFT JOIN USER_IND_EXPRESSIONS ie
                ON ie.index_name = ic.index_name
               AND ie.column_position = ic.column_position
             ORDER BY ic.index_name, ic.column_position
            """, r => new IndexColumn(
                Read(r, 0),
                Convert.ToInt32(r.GetValue(1)),
                Read(r, 2),
                r.IsDBNull(3)
                    ? null
                    : ((OracleDataReader)r).GetOracleString(3).Value));
        var timestampColumns = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT table_name, column_name, data_type
              FROM USER_TAB_COLUMNS
             WHERE data_type LIKE 'TIMESTAMP%WITH TIME ZONE'
            """, r => (Table: Read(r, 0), Column: Read(r, 1), DataType: Read(r, 2)));
        var byName = rows.ToDictionary(x => x.Name, StringComparer.Ordinal);
        var mismatches = new List<string>();
        Assert.Equal(111, ExpectedIndexes.Length);
        foreach (var expected in ExpectedIndexes)
        {
            if (!byName.TryGetValue(expected.Name, out var actual))
            {
                mismatches.Add($"Index {expected.Name}: missing explicit index.");
                continue;
            }

            AddMismatchIfDifferent(mismatches, expected.Name, "table",
                expected.Table, actual.Table);
            AddMismatchIfDifferent(mismatches, expected.Name, "uniqueness",
                expected.Uniqueness, actual.Uniqueness);
            AddMismatchIfDifferent(mismatches, expected.Name, "status",
                "VALID", actual.Status);
            AddMismatchIfDifferent(mismatches, expected.Name, "visibility",
                "VISIBLE", actual.Visibility);
            var expectedColumns = expected.Kind == "FUNCTION"
                ? expected.Expressions ?? throw new InvalidOperationException(
                    $"Missing function expressions for {expected.Name}.")
                : expected.Columns.Split(',', StringSplitOptions.TrimEntries);
            var actualColumns = indexColumns
                .Where(x => x.Name == expected.Name)
                .OrderBy(x => x.Position)
                .ToArray();
            if (expectedColumns.Length != actualColumns.Length)
            {
                mismatches.Add(
                    $"Index {expected.Name}: column count mismatch; expected " +
                    $"{expectedColumns.Length}, actual {actualColumns.Length}. " +
                    $"Actual positions: {FormatActualColumns(actualColumns)}.");
                continue;
            }
            if (expected.Kind == "NORMAL")
            {
                var implicitTimestampColumns = 0;
                for (var position = 0; position < expectedColumns.Length; position++)
                {
                    var expectedColumn = expectedColumns[position];
                    var actualColumn = actualColumns[position];
                    if (actualColumn.ColumnName == expectedColumn &&
                        actualColumn.Expression is null)
                        continue;

                    var expectedType = timestampColumns.SingleOrDefault(x =>
                        x.Table == expected.Table && x.Column == expectedColumn);
                    var expectedExpression = $"SYS_EXTRACT_UTC(\"{expectedColumn}\")";
                    if (expectedType == default)
                    {
                        mismatches.Add(
                            $"Index {expected.Name}, position {actualColumn.Position}: " +
                            $"expected timestamp column {expected.Table}.{expectedColumn} " +
                            "was not found.");
                        continue;
                    }
                    if (!Regex.IsMatch(expectedType.DataType,
                            @"^TIMESTAMP(\([0-9]+\))? WITH TIME ZONE$") ||
                        !actualColumn.ColumnName.StartsWith("SYS_NC",
                            StringComparison.Ordinal) ||
                        !actualColumn.ColumnName.EndsWith("$",
                            StringComparison.Ordinal) ||
                        !ExpressionsEquivalent(expectedExpression,
                            actualColumn.Expression))
                    {
                        mismatches.Add(
                            $"Index {expected.Name}, position {actualColumn.Position}: " +
                            $"expected column {expectedColumn}, expected expression " +
                            $"'{expectedExpression}', actual column " +
                            $"'{actualColumn.ColumnName}', actual expression " +
                            $"'{actualColumn.Expression}'.");
                        continue;
                    }
                    implicitTimestampColumns++;
                }

                var expectedIndexType = expected.OracleIndexType ?? "NORMAL";
                var implicitTstzTypeAccepted =
                    expected.OracleIndexType is null &&
                    IsImplicitTstzFunctionBasedNormal(
                        actual.Type, implicitTimestampColumns);
                if (actual.Type != expectedIndexType && !implicitTstzTypeAccepted)
                {
                    AddMismatchIfDifferent(mismatches, expected.Name, "index type",
                        expectedIndexType, actual.Type);
                }
            }
            else
            {
                if (!actual.Type.StartsWith("FUNCTION-BASED",
                        StringComparison.Ordinal))
                {
                    mismatches.Add($"Index {expected.Name}: expected index type " +
                        $"FUNCTION-BASED*, actual '{actual.Type}'.");
                    continue;
                }
                for (var position = 0; position < expectedColumns.Length; position++)
                {
                    var actualColumn = actualColumns[position];
                    var expectedExpression = expectedColumns[position];
                    var timestampResult = timestampColumns.Any(x =>
                        x.Table == expected.Table &&
                        x.Column == GetCaseResultColumn(expectedExpression));
                    if (!ExpressionsEquivalent(expectedExpression,
                            actualColumn.Expression, timestampResult))
                    {
                        mismatches.Add(
                            $"Index {expected.Name}, position {actualColumn.Position}: " +
                            $"expected expression '{expectedExpression}', actual " +
                            $"expression '{actualColumn.Expression}'.");
                    }
                }
            }
        }
        Assert.True(mismatches.Count == 0,
            "Oracle index validation mismatches:\n" + string.Join("\n", mismatches));
    }

    internal static bool ExpressionsEquivalent(string? expected, string? actual,
        bool allowTimestampWrapper = false)
    {
        if (string.Equals(NormalizeExpression(expected), NormalizeExpression(actual),
                StringComparison.Ordinal))
            return true;

        if (allowTimestampWrapper && actual is not null)
        {
            var wrapper = Regex.Match(actual, """
                ^\s*SYS_EXTRACT_UTC\s*\(\s*(?<inner>.*)\s*\)\s*$
                """, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant |
                    RegexOptions.IgnorePatternWhitespace);
            if (wrapper.Success)
                actual = wrapper.Groups["inner"].Value;
        }

        return TryParseCase(expected, out var expectedCase) &&
            TryParseCase(actual, out var actualCase) &&
            string.Equals(expectedCase!.SourceColumn, actualCase!.SourceColumn,
                StringComparison.Ordinal) &&
            string.Equals(expectedCase.ResultColumn, actualCase.ResultColumn,
                StringComparison.Ordinal) &&
            expectedCase.Values.SequenceEqual(actualCase.Values, StringComparer.Ordinal) &&
            (expectedCase.Conditions is null && actualCase.Conditions is null ||
             expectedCase.Conditions is not null && actualCase.Conditions is not null &&
             expectedCase.Conditions.SequenceEqual(actualCase.Conditions));
    }

    internal static bool IsImplicitTstzFunctionBasedNormal(
        string? actualType, int implicitTimestampColumns) =>
        string.Equals(actualType, "FUNCTION-BASED NORMAL",
             StringComparison.Ordinal) && implicitTimestampColumns > 0;

    private static void AddMismatchIfDifferent(
        ICollection<string> mismatches, string indexName, string field,
        string expected, string? actual)
    {
        if (!string.Equals(expected, actual, StringComparison.Ordinal))
            mismatches.Add($"Index {indexName}: {field} mismatch; expected " +
                $"'{expected}', actual '{actual ?? "<null>"}'.");
    }

    private static string FormatActualColumns(IEnumerable<IndexColumn> columns) =>
        string.Join(", ", columns.Select(column =>
            $"{column.Position}='{column.ColumnName}'/" +
            $"'{column.Expression ?? "<null>"}'"));

    private static string? GetCaseResultColumn(string expression)
    {
        return TryParseCase(expression, out var parsed)
            ? parsed!.ResultColumn
            : null;
    }

    private static string? NormalizeExpression(string? expression) =>
        expression is null
            ? null
            : Regex.Replace(expression, "\"([A-Z][A-Z0-9_$#]*)\"",
                match => match.Groups[1].Value)
                .Where(c => !char.IsWhiteSpace(c))
                .Aggregate(new System.Text.StringBuilder(),
                    (builder, character) => builder.Append(char.ToUpperInvariant(character)))
                .ToString();

    private static bool TryParseCase(string? expression, out ParsedCase? parsed)
    {
        parsed = default;
        if (expression is null)
            return false;

        var searchedPredicate = Regex.Match(expression, """
            ^\s*CASE\s+WHEN\s+(?<predicate>.*?)\s+THEN\s+(?<result>"?[A-Za-z][A-Za-z0-9_$#]*"?)\s+END\s*$
            """, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant |
                RegexOptions.IgnorePatternWhitespace | RegexOptions.Singleline);
        if (searchedPredicate.Success &&
            TryParseConjunctivePredicate(searchedPredicate.Groups["predicate"].Value,
                out var conditions))
        {
            parsed = new ParsedCase(
                null,
                [],
                NormalizeIdentifier(searchedPredicate.Groups["result"].Value),
                conditions);
            return true;
        }

        var searched = Regex.Match(expression, """
            ^\s*CASE\s+WHEN\s+(?<source>"?[A-Za-z][A-Za-z0-9_$#]*"?)\s+IN\s*\((?<values>'(?:''|[^'])*'(?:\s*,\s*'(?:''|[^'])*')*)\)\s+THEN\s+(?<result>"?[A-Za-z][A-Za-z0-9_$#]*"?)\s+END\s*$
            """, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant |
                RegexOptions.IgnorePatternWhitespace);
        if (searched.Success)
        {
            parsed = new ParsedCase(
                NormalizeIdentifier(searched.Groups["source"].Value),
                ParseLiterals(searched.Groups["values"].Value),
                NormalizeIdentifier(searched.Groups["result"].Value));
            return true;
        }

        var searchedEquality = Regex.Match(expression, """
            ^\s*CASE\s+WHEN\s+(?<source>"?[A-Za-z][A-Za-z0-9_$#]*"?)\s*=\s*(?<value>'(?:''|[^'])*')\s+THEN\s+(?<result>"?[A-Za-z][A-Za-z0-9_$#]*"?)\s+END\s*$
            """, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant |
                RegexOptions.IgnorePatternWhitespace);
        if (searchedEquality.Success)
        {
            parsed = new ParsedCase(
                NormalizeIdentifier(searchedEquality.Groups["source"].Value),
                [UnquoteLiteral(searchedEquality.Groups["value"].Value)],
                NormalizeIdentifier(searchedEquality.Groups["result"].Value));
            return true;
        }

        var simple = Regex.Match(expression, """
            ^\s*CASE\s+(?<source>"?[A-Za-z][A-Za-z0-9_$#]*"?)\s+(?<branches>(?:WHEN\s+'(?:''|[^'])*'\s+THEN\s+"?[A-Za-z][A-Za-z0-9_$#]*"?\s*)+)END\s*$
            """, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant |
                RegexOptions.IgnorePatternWhitespace);
        if (!simple.Success)
            return false;

        var branchMatches = Regex.Matches(simple.Groups["branches"].Value, """
            WHEN\s+(?<value>'(?:''|[^'])*')\s+THEN\s+(?<result>"?[A-Za-z][A-Za-z0-9_$#]*"?)
            """, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant |
                RegexOptions.IgnorePatternWhitespace);
        if (branchMatches.Count == 0)
            return false;

        var result = NormalizeIdentifier(branchMatches[0].Groups["result"].Value);
        if (branchMatches.Cast<Match>().Any(match =>
                NormalizeIdentifier(match.Groups["result"].Value) != result))
            return false;

        parsed = new ParsedCase(
            NormalizeIdentifier(simple.Groups["source"].Value),
            branchMatches.Cast<Match>()
                .Select(match => UnquoteLiteral(match.Groups["value"].Value))
                .ToArray(),
            result);
        return true;
    }

    private static string[] ParseLiterals(string values) =>
        Regex.Matches(values, "'(?:''|[^'])*'")
            .Cast<Match>()
            .Select(match => UnquoteLiteral(match.Value))
            .ToArray();

    private static string UnquoteLiteral(string value) =>
        value[1..^1].Replace("''", "'", StringComparison.Ordinal);

    private static string NormalizeIdentifier(string identifier)
    {
        var trimmed = identifier.Trim();
        if (trimmed.Length >= 2 && trimmed[0] == '"' && trimmed[^1] == '"')
        {
            var quoted = trimmed[1..^1];
            return quoted == quoted.ToUpperInvariant()
                ? quoted
                : trimmed;
        }
        return trimmed.ToUpperInvariant();
    }

    private static bool TryParseConjunctivePredicate(
        string predicate, out CaseCondition[] conditions)
    {
        conditions = [];
        var trimmed = predicate.Trim();
        if (trimmed.StartsWith("(", StringComparison.Ordinal) &&
            trimmed.EndsWith(")", StringComparison.Ordinal) &&
            EnclosesEntireExpression(trimmed))
            trimmed = trimmed[1..^1].Trim();

        var parts = SplitTopLevelAnd(trimmed);
        if (parts.Count < 2)
            return false;

        var parsed = new List<CaseCondition>(parts.Count);
        foreach (var part in parts)
        {
            var match = Regex.Match(part, """
                ^\s*(?<column>"?[A-Za-z][A-Za-z0-9_$#]*"?)\s*=\s*
                (?<literal>'(?:''|[^'])*'|[+-]?[0-9]+(?:\.[0-9]+)?)\s*$
                """, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant |
                    RegexOptions.IgnorePatternWhitespace);
            if (!match.Success)
                return false;

            var literal = match.Groups["literal"].Value;
            parsed.Add(new CaseCondition(
                NormalizeIdentifier(match.Groups["column"].Value),
                "=",
                literal[0] == '\'' ? UnquoteLiteral(literal) : literal));
        }

        conditions = parsed.ToArray();
        return true;
    }

    private static List<string> SplitTopLevelAnd(string expression)
    {
        var parts = new List<string>();
        var start = 0;
        var depth = 0;
        var inString = false;
        for (var i = 0; i < expression.Length; i++)
        {
            var character = expression[i];
            if (character == '\'')
            {
                if (inString && i + 1 < expression.Length && expression[i + 1] == '\'')
                {
                    i++;
                    continue;
                }
                inString = !inString;
                continue;
            }
            if (inString)
                continue;
            if (character == '(')
            {
                depth++;
                continue;
            }
            if (character == ')')
            {
                depth--;
                continue;
            }
            if (depth == 0 && i + 3 <= expression.Length &&
                string.Equals(expression.Substring(i, 3), "AND",
                    StringComparison.OrdinalIgnoreCase) &&
                (i == 0 || char.IsWhiteSpace(expression[i - 1])) &&
                (i + 3 == expression.Length || char.IsWhiteSpace(expression[i + 3])))
            {
                parts.Add(expression[start..i]);
                start = i + 3;
                i += 2;
            }
        }
        parts.Add(expression[start..]);
        return parts;
    }

    private static bool EnclosesEntireExpression(string expression)
    {
        var depth = 0;
        var inString = false;
        for (var i = 0; i < expression.Length; i++)
        {
            var character = expression[i];
            if (character == '\'')
            {
                if (inString && i + 1 < expression.Length && expression[i + 1] == '\'')
                {
                    i++;
                    continue;
                }
                inString = !inString;
                continue;
            }
            if (inString)
                continue;
            if (character == '(')
                depth++;
            else if (character == ')' && --depth == 0 && i != expression.Length - 1)
                return false;
        }
        return depth == 0;
    }

    private sealed record CaseCondition(string Column, string Operator, string Literal);
    private sealed record ParsedCase(
        string? SourceColumn, string[] Values, string ResultColumn,
        CaseCondition[]? Conditions = null);

    private static void AssertStringEqual(string? expected, string? actual, string context)
    {
        Assert.True(string.Equals(expected, actual, StringComparison.Ordinal),
            $"{context} Expected: '{expected}'. Actual: '{actual ?? "<null>"}'.");
    }

    [Fact(Skip = "Requires dedicated Oracle test PDB and opt-in.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task PublicViews_ExposeOnlyTheApprovedColumnProjections()
    {
        await using var connection = await _fixture.OpenVerifiedAsync();
        var views = await ApiDatabaseFixture.SelectAsync(connection,
            "SELECT object_name, status FROM USER_OBJECTS WHERE object_type = 'VIEW'",
            r => (Name: Read(r, 0), Status: Read(r, 1)));
        AssertSameNames("public views", ExpectedPublicViewColumns.Keys, views.Select(x => x.Name));
        foreach (var v in views) Assert.Equal("VALID", v.Status);

        var columns = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT table_name, column_name, column_id
              FROM USER_TAB_COLUMNS
             WHERE table_name LIKE 'VW_PUBLIC_%'
             ORDER BY table_name, column_id
            """, r => (View: Read(r, 0), Column: Read(r, 1), Position: Convert.ToInt32(r.GetValue(2))));
        foreach (var (name, expected) in ExpectedPublicViewColumns)
        {
            var actual = columns.Where(x => x.View == name).OrderBy(x => x.Position)
                .Select(x => x.Column).ToArray();
            Assert.Equal(expected, actual);
        }
        // The column projection is necessary but is NOT a substitute for
        // API authorization or review of the view's filtering predicates.
    }

    [Fact(Skip = "Requires dedicated Oracle test PDB and opt-in.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task OracleConstraints_AreNotDisabledOrLeftUnvalidated()
    {
        await using var connection = await _fixture.OpenVerifiedAsync();
        var broken = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT constraint_name || ':' || status || '/' || validated
              FROM USER_CONSTRAINTS
             WHERE constraint_type IN ('P','U','R','C')
               AND (status <> 'ENABLED' OR validated <> 'VALIDATED')
            """, ReadSingle);
        Assert.True(broken.Count == 0, "Disabled or unvalidated constraints: " + string.Join(", ", broken));
    }

    [Fact(Skip = "Requires dedicated Oracle test PDB and opt-in.",
          SkipUnless = nameof(ApiDatabaseFixture.IsEnabled), SkipType = typeof(ApiDatabaseFixture))]
    public async Task ReferenceFoodCategories_ContainTheSixCanonicalSlugs()
    {
        await using var connection = await _fixture.OpenVerifiedAsync();
        var slugs = await ApiDatabaseFixture.SelectAsync(connection, """
            SELECT slug FROM FOOD_CATEGORIES WHERE slug IN
            ('dog-food','cat-food','bird-food','fish-food','small-pet-food','pet-treats')
            """, ReadSingle);
        AssertSameNames("reference category slugs",
            ["dog-food", "cat-food", "bird-food", "fish-food", "small-pet-food", "pet-treats"],
            slugs);
        // Optional 002_demo_data_dev_only.sql is NOT required or modified.
    }

    private static string Read(DbDataReader reader, int index) =>
        reader.IsDBNull(index) ? "" : Convert.ToString(reader.GetValue(index))?.Trim() ?? "";

    private static string ReadSingle(DbDataReader reader) => Read(reader, 0);

    private static void AssertSameNames(string kind, IEnumerable<string> expected, IEnumerable<string> actual)
    {
        var wanted = new HashSet<string>(expected, StringComparer.Ordinal);
        var found = new HashSet<string>(actual, StringComparer.Ordinal);
        var missing = wanted.Except(found, StringComparer.Ordinal).OrderBy(x => x).ToArray();
        var extra = found.Except(wanted, StringComparer.Ordinal).OrderBy(x => x).ToArray();
        Assert.True(missing.Length == 0 && extra.Length == 0,
            $"{kind} mismatch. Missing: [{string.Join(", ", missing)}]. Extra: [{string.Join(", ", extra)}].");
        Assert.Equal(wanted.Count, found.Count);
    }
}
