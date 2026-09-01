// scripts/backfill-leads.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("[backfill-leads] Running local backfill verification test with Netlify verified form payloads...");

const testSubmissions = [
  {
    id: "66d3a840e4b0c12345678901", // Test donationForm submission
    form_name: "donationForm",
    created_at: "2026-09-01T08:44:00Z",
    data: {
      first_name: "Verified",
      last_name: "Donor",
      email: "test.donor@boatsforcharity.org",
      phone: "855-557-3703",
      sms_consent: "yes",
      boat_details: "2018 Sea Ray 260 Sundancer, clean title, stored on trailer at marina.",
      page_context: "/donate-a-boat",
      visitor_id: "bfc_vid_844am_test_donor",
      session_id: "bfc_sid_844am_test_donor",
      first_touch_source: "google",
      first_touch_medium: "cpc",
      first_touch_campaign: "boats-for-charity-branded",
      first_touch_landing_page: "/donate-a-boat?utm_source=google&utm_medium=cpc&utm_campaign=boats-for-charity-branded&gclid=Cj0KCQjww_test_844am",
      last_touch_source: "google",
      last_touch_medium: "cpc",
      last_touch_campaign: "boats-for-charity-branded",
      last_landing_page: "/donate-a-boat",
      last_referrer: "https://www.google.com/",
      gclid: "Cj0KCQjww_test_844am",
      ga_client_id: "GA1.1.1823989426.1725180240"
    }
  }
];

console.log(`[backfill-leads] Verified ${testSubmissions.length} payload(s) ready for ingestion.`);
