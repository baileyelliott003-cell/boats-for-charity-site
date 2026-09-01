// db/schema.ts
import { pgTable, serial, text, timestamp, boolean, integer, numeric, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ========================================== 
// 1. VISITORS & SESSIONS (First-party tracking)
// ==========================================

export const visitors = pgTable(
  "visitors",
  {
    id: text("id").primaryKey(), // Anonymous first-party UUID e.g. bfc_v_...
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    firstTouchSource: text("first_touch_source").default(""),
    firstTouchMedium: text("first_touch_medium").default(""),
    firstTouchCampaign: text("first_touch_campaign").default(""),
    firstTouchTerm: text("first_touch_term").default(""),
    firstTouchContent: text("first_touch_content").default(""),
    firstLandingPage: text("first_landing_page").default(""),
    firstReferrer: text("first_referrer").default(""),
    firstReferringDomain: text("first_referring_domain").default(""),
    firstGclid: text("first_gclid").default(""),
    firstGbraid: text("first_gbraid").default(""),
    firstWbraid: text("first_wbraid").default(""),
    firstMsclkid: text("first_msclkid").default(""),
    gaClientId: text("ga_client_id").default(""),
    deviceCategory: text("device_category").default(""),
    userAgent: text("user_agent").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("visitors_first_seen_idx").on(t.firstSeenAt),
    index("visitors_last_seen_idx").on(t.lastSeenAt),
    index("visitors_ga_client_id_idx").on(t.gaClientId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // Anonymous session UUID e.g. bfc_s_...
    visitorId: text("visitor_id").notNull().references(() => visitors.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
    landingPage: text("landing_page").default(""),
    referrer: text("referrer").default(""),
    referringDomain: text("referring_domain").default(""),
    utmSource: text("utm_source").default(""),
    utmMedium: text("utm_medium").default(""),
    utmCampaign: text("utm_campaign").default(""),
    utmTerm: text("utm_term").default(""),
    utmContent: text("utm_content").default(""),
    gclid: text("gclid").default(""),
    gbraid: text("gbraid").default(""),
    wbraid: text("wbraid").default(""),
    msclkid: text("msclkid").default(""),
    deviceCategory: text("device_category").default(""),
    userAgent: text("user_agent").default(""),
    isBot: boolean("is_bot").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("sessions_visitor_id_idx").on(t.visitorId),
    index("sessions_started_at_idx").on(t.startedAt),
    index("sessions_last_activity_idx").on(t.lastActivityAt),
  ]
);

// ==========================================
// 2. EVENTS (Granular interaction tracking)
// ==========================================

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    eventName: text("event_name").notNull(), // page_view, donation_form_view, form_start, form_submit_attempt, phone_click, verified_lead
    pagePath: text("page_path").default(""),
    source: text("source").default(""),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    isBot: boolean("is_bot").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("events_visitor_id_idx").on(t.visitorId),
    index("events_session_id_idx").on(t.sessionId),
    index("events_event_name_idx").on(t.eventName),
    index("events_created_at_idx").on(t.createdAt),
  ]
);

// ==========================================
// 3. LEADS (Netlify Verified Submissions)
// ==========================================

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    netlifySubmissionId: text("netlify_submission_id").notNull(),
    formName: text("form_name").notNull().default("donationForm"),
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    boatId: integer("boat_id"), // Linked to boat if created
    
    // Contact Data (Secure)
    firstName: text("first_name").default(""),
    lastName: text("last_name").default(""),
    email: text("email").default(""),
    phone: text("phone").default(""),
    smsConsent: boolean("sms_consent").default(false).notNull(),
    boatDetails: text("boat_details").default(""),
    pageContext: text("page_context").default(""),
    
    // Pipeline Stage: New | Contacted | Qualified | Donation Accepted | Listed | Sold | Closed Lost
    stage: text("stage").notNull().default("New"),
    
    // First Touch & Last Non-Direct Attribution snapshots
    firstTouchSource: text("first_touch_source").default(""),
    firstTouchMedium: text("first_touch_medium").default(""),
    firstTouchCampaign: text("first_touch_campaign").default(""),
    firstTouchLandingPage: text("first_touch_landing_page").default(""),
    
    lastTouchSource: text("last_touch_source").default(""),
    lastTouchMedium: text("last_touch_medium").default(""),
    lastTouchCampaign: text("last_touch_campaign").default(""),
    lastTouchTerm: text("last_touch_term").default(""),
    lastTouchContent: text("last_touch_content").default(""),
    lastLandingPage: text("last_landing_page").default(""),
    lastReferrer: text("last_referrer").default(""),
    
    // Ad Click IDs
    gclid: text("gclid").default(""),
    gbraid: text("gbraid").default(""),
    wbraid: text("wbraid").default(""),
    msclkid: text("msclkid").default(""),
    gaClientId: text("ga_client_id").default(""),
    
    rawFormData: jsonb("raw_form_data").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("leads_netlify_submission_id_uniq").on(t.netlifySubmissionId),
    index("leads_visitor_id_idx").on(t.visitorId),
    index("leads_session_id_idx").on(t.sessionId),
    index("leads_stage_idx").on(t.stage),
    index("leads_created_at_idx").on(t.createdAt),
  ]
);

// ==========================================
// 4. CALLS (WhatConverts & Quo Integration)
// ==========================================

export const calls = pgTable(
  "calls",
  {
    id: serial("id").primaryKey(),
    callId: text("call_id").notNull(), // WhatConverts or provider lead/call ID
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    boatId: integer("boat_id"),
    
    callerNumber: text("caller_number").default(""),
    trackingNumber: text("tracking_number").default(""),
    forwardedToNumber: text("forwarded_to_number").default("855-557-3703"),
    callDurationSeconds: integer("call_duration_seconds").default(0),
    callStatus: text("call_status").default("completed"), // answered, missed, voicemail
    callTime: timestamp("call_time", { withTimezone: true }).defaultNow().notNull(),
    
    // Attribution
    source: text("source").default(""),
    medium: text("medium").default(""),
    campaign: text("campaign").default(""),
    keyword: text("keyword").default(""),
    landingPage: text("landing_page").default(""),
    gclid: text("gclid").default(""),
    msclkid: text("msclkid").default(""),
    
    stage: text("stage").notNull().default("New"),
    recordingDisabled: boolean("recording_disabled").notNull().default(true),
    rawPayload: jsonb("raw_payload").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("calls_call_id_uniq").on(t.callId),
    index("calls_visitor_id_idx").on(t.visitorId),
    index("calls_caller_number_idx").on(t.callerNumber),
    index("calls_created_at_idx").on(t.createdAt),
  ]
);

// ==========================================
// 5. BOATS (Accepted Donations & Vessel records)
// ==========================================

export const boats = pgTable(
  "boats",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    callId: integer("call_id").references(() => calls.id, { onDelete: "set null" }),
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    
    title: text("title").notNull(), // e.g. 1997 Bayliner Ciera 28
    hin: text("hin").default(""),
    year: integer("year"),
    make: text("make").default(""),
    model: text("model").default(""),
    lengthFt: numeric("length_ft"),
    vesselType: text("vessel_type").default(""), // Powerboat, Sailboat, Yacht, PWC, Trailer
    condition: text("condition").default(""),
    locationCity: text("location_city").default(""),
    locationState: text("location_state").default(""),
    status: text("status").notNull().default("Donation Accepted"), // Donation Accepted, Listed, Sold, Closed
    acceptedDate: timestamp("accepted_date", { withTimezone: true }).defaultNow().notNull(),
    notes: text("notes").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("boats_lead_id_idx").on(t.leadId),
    index("boats_visitor_id_idx").on(t.visitorId),
    index("boats_status_idx").on(t.status),
  ]
);

// ==========================================
// 6. EBAY LISTINGS (Inventory & Relist Tracking)
// ==========================================

export const ebayListings = pgTable(
  "ebay_listings",
  {
    id: serial("id").primaryKey(),
    boatId: integer("boat_id").notNull().references(() => boats.id, { onDelete: "cascade" }),
    ebayItemId: text("ebay_item_id").notNull(),
    listingUrl: text("listing_url").default(""),
    auctionStartDate: timestamp("auction_start_date", { withTimezone: true }),
    auctionEndDate: timestamp("auction_end_date", { withTimezone: true }),
    listingStatus: text("listing_status").notNull().default("Active"), // Active, Ended, Relisted, Sold
    isFinalSale: boolean("is_final_sale").default(false).notNull(), // TRUE ONLY for the winning/final sold listing
    startingPrice: numeric("starting_price"),
    currentPrice: numeric("current_price"),
    relistCount: integer("relist_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ebay_listings_item_id_uniq").on(t.ebayItemId),
    index("ebay_listings_boat_id_idx").on(t.boatId),
    index("ebay_listings_is_final_sale_idx").on(t.isFinalSale),
  ]
);

// ==========================================
// 7. SALES (Final Sold Vessels & Revenue)
// ==========================================

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    boatId: integer("boat_id").notNull().references(() => boats.id, { onDelete: "cascade" }),
    listingId: integer("listing_id").references(() => ebayListings.id, { onDelete: "set null" }),
    visitorId: text("visitor_id").references(() => visitors.id, { onDelete: "set null" }),
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    
    saleAmount: numeric("sale_amount").notNull(), // Final Gross sale value
    saleDate: timestamp("sale_date", { withTimezone: true }).defaultNow().notNull(),
    buyerPaymentStatus: text("buyer_payment_status").notNull().default("Paid"), // Pending, Paid, Refunded
    form1098cIssued: boolean("form_1098c_issued").default(false).notNull(),
    notes: text("notes").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sales_boat_id_uniq").on(t.boatId), // Enforce exactly ONE successful sale per boat
    index("sales_visitor_id_idx").on(t.visitorId),
    index("sales_lead_id_idx").on(t.leadId),
    index("sales_sale_date_idx").on(t.saleDate),
  ]
);

// ==========================================
// 8. CONVERSION EXPORTS (Google Ads Offline / Enhanced)
// ==========================================

export const conversionExports = pgTable(
  "conversion_exports",
  {
    id: serial("id").primaryKey(),
    conversionId: text("conversion_id").notNull(), // Unique deduplication ID e.g. bfc_conv_lead_123
    conversionType: text("conversion_type").notNull(), // Qualified_Lead, Donation_Accepted, Boat_Sold
    leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
    callId: integer("call_id").references(() => calls.id, { onDelete: "set null" }),
    boatId: integer("boat_id").references(() => boats.id, { onDelete: "set null" }),
    saleId: integer("sale_id").references(() => sales.id, { onDelete: "set null" }),
    
    gclid: text("gclid").default(""),
    gbraid: text("gbraid").default(""),
    wbraid: text("wbraid").default(""),
    conversionTime: timestamp("conversion_time", { withTimezone: true }).defaultNow().notNull(),
    conversionValue: numeric("conversion_value").default("0"),
    currency: text("currency").default("USD").notNull(),
    
    // SHA-256 Hashed donor data for Enhanced Conversions
    hashedEmail: text("hashed_email").default(""),
    hashedPhone: text("hashed_phone").default(""),
    
    exportStatus: text("export_status").default("Pending"), // Pending, Uploaded, Failed
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    responseDetails: jsonb("response_details").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("conversion_exports_conv_id_uniq").on(t.conversionId),
    index("conversion_exports_type_idx").on(t.conversionType),
    index("conversion_exports_status_idx").on(t.exportStatus),
  ]
);

// ==========================================
// 9. AUDIT HISTORY (Manual Corrections & Edits)
// ==========================================

export const auditHistory = pgTable(
  "audit_history",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(), // lead, call, boat, listing, sale
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // update_attribution, change_stage, link_boat, edit_sale
    performedBy: text("performed_by").default("system"),
    previousState: jsonb("previous_state").$type<Record<string, any>>().default({}),
    newState: jsonb("new_state").$type<Record<string, any>>().default({}),
    notes: text("notes").default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_history_entity_idx").on(t.entityType, t.entityId),
    index("audit_history_created_at_idx").on(t.createdAt),
  ]
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    csrfHash: text("csrf_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("admin_sessions_token_hash_uniq").on(t.tokenHash),
    index("admin_sessions_expires_at_idx").on(t.expiresAt),
    index("admin_sessions_revoked_at_idx").on(t.revokedAt),
  ]
);

export const abuseRateLimits = pgTable(
  "abuse_rate_limits",
  {
    scope: text("scope").notNull(),
    identifierHash: text("identifier_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("abuse_rate_limits_scope_identifier_uniq").on(t.scope, t.identifierHash),
    index("abuse_rate_limits_updated_at_idx").on(t.updatedAt),
  ]
);

// ==========================================
// 10. PRESERVED LEGACY TABLES (Safely Hashed IP)
// ==========================================

export const donateClicks = pgTable(
  "donate_clicks",
  {
    id: serial("id").primaryKey(),
    source: text().notNull().default("unknown"),
    path: text().notNull().default(""),
    ipHash: text("ip_hash").notNull().default(""), // Hashed IP to protect privacy
    userAgent: text("user_agent").notNull().default(""),
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("donate_clicks_created_at_idx").on(t.createdAt),
    index("donate_clicks_ip_hash_idx").on(t.ipHash),
  ]
);

export const visits = pgTable(
  "visits",
  {
    id: serial("id").primaryKey(),
    path: text().notNull().default(""),
    ipHash: text("ip_hash").notNull().default(""), // Hashed IP to protect privacy
    userAgent: text("user_agent").notNull().default(""),
    isBot: boolean("is_bot").notNull().default(false),
    country: text().notNull().default(""),
    referrer: text().notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("visits_created_at_idx").on(t.createdAt),
    index("visits_ip_hash_idx").on(t.ipHash),
  ]
);
