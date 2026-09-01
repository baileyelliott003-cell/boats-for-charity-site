// db/migrate.ts
import { sql } from "drizzle-orm";
import { db } from "./index.js";

/**
 * Safe, reversible, non-destructive migration helper.
 * Creates all new attribution and transaction tables if not exists
 * and migrates legacy columns safely.
 */
export async function runMigrations() {
  console.log("[db:migrate] Starting safe database migrations...");

  // 1. Visitors
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS visitors (
      id text PRIMARY KEY,
      first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
      last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
      first_touch_source text DEFAULT '',
      first_touch_medium text DEFAULT '',
      first_touch_campaign text DEFAULT '',
      first_touch_term text DEFAULT '',
      first_touch_content text DEFAULT '',
      first_landing_page text DEFAULT '',
      first_referrer text DEFAULT '',
      first_referring_domain text DEFAULT '',
      first_gclid text DEFAULT '',
      first_gbraid text DEFAULT '',
      first_wbraid text DEFAULT '',
      first_msclkid text DEFAULT '',
      ga_client_id text DEFAULT '',
      device_category text DEFAULT '',
      user_agent text DEFAULT '',
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS visitors_first_seen_idx ON visitors(first_seen_at);
    CREATE INDEX IF NOT EXISTS visitors_last_seen_idx ON visitors(last_seen_at);
    CREATE INDEX IF NOT EXISTS visitors_ga_client_id_idx ON visitors(ga_client_id);
  `);

  // 2. Sessions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id text PRIMARY KEY,
      visitor_id text NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
      started_at timestamp with time zone DEFAULT now() NOT NULL,
      last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
      landing_page text DEFAULT '',
      referrer text DEFAULT '',
      referring_domain text DEFAULT '',
      utm_source text DEFAULT '',
      utm_medium text DEFAULT '',
      utm_campaign text DEFAULT '',
      utm_term text DEFAULT '',
      utm_content text DEFAULT '',
      gclid text DEFAULT '',
      gbraid text DEFAULT '',
      wbraid text DEFAULT '',
      msclkid text DEFAULT '',
      device_category text DEFAULT '',
      user_agent text DEFAULT '',
      is_bot boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_visitor_id_idx ON sessions(visitor_id);
    CREATE INDEX IF NOT EXISTS sessions_started_at_idx ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS sessions_last_activity_idx ON sessions(last_activity_at);
  `);

  // 3. Events
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS events (
      id serial PRIMARY KEY,
      visitor_id text REFERENCES visitors(id) ON DELETE SET NULL,
      session_id text REFERENCES sessions(id) ON DELETE SET NULL,
      event_name text NOT NULL,
      page_path text DEFAULT '',
      source text DEFAULT '',
      metadata jsonb DEFAULT '{}'::jsonb,
      is_bot boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_visitor_id_idx ON events(visitor_id);
    CREATE INDEX IF NOT EXISTS events_session_id_idx ON events(session_id);
    CREATE INDEX IF NOT EXISTS events_event_name_idx ON events(event_name);
    CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at);
  `);

  // 4. Leads
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS leads (
      id serial PRIMARY KEY,
      netlify_submission_id text NOT NULL,
      form_name text DEFAULT 'donationForm' NOT NULL,
      visitor_id text REFERENCES visitors(id) ON DELETE SET NULL,
      session_id text REFERENCES sessions(id) ON DELETE SET NULL,
      boat_id integer,
      first_name text DEFAULT '',
      last_name text DEFAULT '',
      email text DEFAULT '',
      phone text DEFAULT '',
      sms_consent boolean DEFAULT false NOT NULL,
      boat_details text DEFAULT '',
      page_context text DEFAULT '',
      stage text DEFAULT 'New' NOT NULL,
      first_touch_source text DEFAULT '',
      first_touch_medium text DEFAULT '',
      first_touch_campaign text DEFAULT '',
      first_touch_landing_page text DEFAULT '',
      last_touch_source text DEFAULT '',
      last_touch_medium text DEFAULT '',
      last_touch_campaign text DEFAULT '',
      last_touch_term text DEFAULT '',
      last_touch_content text DEFAULT '',
      last_landing_page text DEFAULT '',
      last_referrer text DEFAULT '',
      gclid text DEFAULT '',
      gbraid text DEFAULT '',
      wbraid text DEFAULT '',
      msclkid text DEFAULT '',
      ga_client_id text DEFAULT '',
      raw_form_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS leads_netlify_submission_id_uniq ON leads(netlify_submission_id);
    CREATE INDEX IF NOT EXISTS leads_visitor_id_idx ON leads(visitor_id);
    CREATE INDEX IF NOT EXISTS leads_session_id_idx ON leads(session_id);
    CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads(stage);
    CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at);
  `);

  // 5. Calls
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS calls (
      id serial PRIMARY KEY,
      call_id text NOT NULL,
      visitor_id text REFERENCES visitors(id) ON DELETE SET NULL,
      session_id text REFERENCES sessions(id) ON DELETE SET NULL,
      lead_id integer REFERENCES leads(id) ON DELETE SET NULL,
      boat_id integer,
      caller_number text DEFAULT '',
      tracking_number text DEFAULT '',
      forwarded_to_number text DEFAULT '855-557-3703',
      call_duration_seconds integer DEFAULT 0,
      call_status text DEFAULT 'completed',
      call_time timestamp with time zone DEFAULT now() NOT NULL,
      source text DEFAULT '',
      medium text DEFAULT '',
      campaign text DEFAULT '',
      keyword text DEFAULT '',
      landing_page text DEFAULT '',
      gclid text DEFAULT '',
      msclkid text DEFAULT '',
      stage text DEFAULT 'New' NOT NULL,
      recording_disabled boolean DEFAULT true NOT NULL,
      raw_payload jsonb DEFAULT '{}'::jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS calls_call_id_uniq ON calls(call_id);
    CREATE INDEX IF NOT EXISTS calls_visitor_id_idx ON calls(visitor_id);
    CREATE INDEX IF NOT EXISTS calls_caller_number_idx ON calls(caller_number);
    CREATE INDEX IF NOT EXISTS calls_created_at_idx ON calls(created_at);
  `);

  // 6. Boats
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS boats (
      id serial PRIMARY KEY,
      lead_id integer REFERENCES leads(id) ON DELETE SET NULL,
      call_id integer REFERENCES calls(id) ON DELETE SET NULL,
      visitor_id text REFERENCES visitors(id) ON DELETE SET NULL,
      title text NOT NULL,
      hin text DEFAULT '',
      year integer,
      make text DEFAULT '',
      model text DEFAULT '',
      length_ft numeric,
      vessel_type text DEFAULT '',
      condition text DEFAULT '',
      location_city text DEFAULT '',
      location_state text DEFAULT '',
      status text DEFAULT 'Donation Accepted' NOT NULL,
      accepted_date timestamp with time zone DEFAULT now() NOT NULL,
      notes text DEFAULT '',
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS boats_lead_id_idx ON boats(lead_id);
    CREATE INDEX IF NOT EXISTS boats_visitor_id_idx ON boats(visitor_id);
    CREATE INDEX IF NOT EXISTS boats_status_idx ON boats(status);
  `);

  // 7. eBay Listings
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ebay_listings (
      id serial PRIMARY KEY,
      boat_id integer NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
      ebay_item_id text NOT NULL,
      listing_url text DEFAULT '',
      auction_start_date timestamp with time zone,
      auction_end_date timestamp with time zone,
      listing_status text DEFAULT 'Active' NOT NULL,
      is_final_sale boolean DEFAULT false NOT NULL,
      starting_price numeric,
      current_price numeric,
      relist_count integer DEFAULT 0 NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ebay_listings_item_id_uniq ON ebay_listings(ebay_item_id);
    CREATE INDEX IF NOT EXISTS ebay_listings_boat_id_idx ON ebay_listings(boat_id);
    CREATE INDEX IF NOT EXISTS ebay_listings_is_final_sale_idx ON ebay_listings(is_final_sale);
  `);

  // 8. Sales
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sales (
      id serial PRIMARY KEY,
      boat_id integer NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
      listing_id integer REFERENCES ebay_listings(id) ON DELETE SET NULL,
      visitor_id text REFERENCES visitors(id) ON DELETE SET NULL,
      lead_id integer REFERENCES leads(id) ON DELETE SET NULL,
      sale_amount numeric NOT NULL,
      sale_date timestamp with time zone DEFAULT now() NOT NULL,
      buyer_payment_status text DEFAULT 'Paid' NOT NULL,
      form_1098c_issued boolean DEFAULT false NOT NULL,
      notes text DEFAULT '',
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sales_boat_id_uniq ON sales(boat_id);
    CREATE INDEX IF NOT EXISTS sales_visitor_id_idx ON sales(visitor_id);
    CREATE INDEX IF NOT EXISTS sales_lead_id_idx ON sales(lead_id);
    CREATE INDEX IF NOT EXISTS sales_sale_date_idx ON sales(sale_date);
  `);

  // 9. Conversion Exports
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversion_exports (
      id serial PRIMARY KEY,
      conversion_id text NOT NULL,
      conversion_type text NOT NULL,
      lead_id integer REFERENCES leads(id) ON DELETE SET NULL,
      call_id integer REFERENCES calls(id) ON DELETE SET NULL,
      boat_id integer REFERENCES boats(id) ON DELETE SET NULL,
      sale_id integer REFERENCES sales(id) ON DELETE SET NULL,
      gclid text DEFAULT '',
      gbraid text DEFAULT '',
      wbraid text DEFAULT '',
      conversion_time timestamp with time zone DEFAULT now() NOT NULL,
      conversion_value numeric DEFAULT '0',
      currency text DEFAULT 'USD' NOT NULL,
      hashed_email text DEFAULT '',
      hashed_phone text DEFAULT '',
      export_status text DEFAULT 'Pending',
      exported_at timestamp with time zone,
      response_details jsonb DEFAULT '{}'::jsonb,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS conversion_exports_conv_id_uniq ON conversion_exports(conversion_id);
    CREATE INDEX IF NOT EXISTS conversion_exports_type_idx ON conversion_exports(conversion_type);
    CREATE INDEX IF NOT EXISTS conversion_exports_status_idx ON conversion_exports(export_status);
  `);

  // 10. Audit History
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_history (
      id serial PRIMARY KEY,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      action text NOT NULL,
      performed_by text DEFAULT 'system',
      previous_state jsonb DEFAULT '{}'::jsonb,
      new_state jsonb DEFAULT '{}'::jsonb,
      notes text DEFAULT '',
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_history_entity_idx ON audit_history(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS audit_history_created_at_idx ON audit_history(created_at);
  `);

  // 11. Protect Legacy visits & donate_clicks with ip_hash column
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visits') THEN
        ALTER TABLE visits ADD COLUMN IF NOT EXISTS ip_hash text DEFAULT '';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'donate_clicks') THEN
        ALTER TABLE donate_clicks ADD COLUMN IF NOT EXISTS ip_hash text DEFAULT '';
      END IF;
    END $$;
  `);

  console.log("[db:migrate] All migrations applied successfully.");
}
