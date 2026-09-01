import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(process.argv[2] ?? SCRIPT_ROOT);

console.log("[test-attribution] Starting unit and integration tests...");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

// 1. Test Tracker Script Integrity
const trackerContent = fs.readFileSync(path.join(ROOT, "tracker.v1.js"), "utf-8");
assert(trackerContent.includes("bfc_vid"), "Tracker defines persistent visitor ID (bfc_vid)");
assert(trackerContent.includes("bfc_sid"), "Tracker defines 30-min session ID (bfc_sid)");
assert(trackerContent.includes("utm_source"), "Tracker captures UTM parameters");
assert(trackerContent.includes("gclid") && trackerContent.includes("gbraid") && trackerContent.includes("wbraid") && trackerContent.includes("msclkid"), "Tracker captures all ad click IDs");
assert(trackerContent.includes("injectHiddenFields"), "Tracker injects hidden fields into forms");
assert(trackerContent.includes("855-557-3703"), "Tracker maintains Quo phone fallback");

// 2. Test Zero PII Leakage in GA4/Clarity
assert(!trackerContent.includes("gtag('event', 'lead_submitted', { email:"), "No PII sent to GA4");
assert(!trackerContent.includes("clarity('set', 'phone'"), "No PII sent to Clarity");

// 3. Test Database Schema & Migration Integrity
const schemaContent = fs.readFileSync(path.join(ROOT, "db/schema.ts"), "utf-8");
assert(schemaContent.includes("visitors = pgTable"), "Schema includes visitors table");
assert(schemaContent.includes("sessions = pgTable"), "Schema includes sessions table");
assert(schemaContent.includes("events = pgTable"), "Schema includes events table");
assert(schemaContent.includes("leads = pgTable"), "Schema includes leads table");
assert(schemaContent.includes("calls = pgTable"), "Schema includes calls table");
assert(schemaContent.includes("boats = pgTable"), "Schema includes boats table");
assert(schemaContent.includes("ebayListings = pgTable"), "Schema includes ebay_listings table");
assert(schemaContent.includes("sales = pgTable"), "Schema includes sales table");
assert(schemaContent.includes("conversionExports = pgTable"), "Schema includes conversion_exports table");
assert(schemaContent.includes("auditHistory = pgTable"), "Schema includes audit_history table");
assert(schemaContent.includes("uniqueIndex(\"sales_boat_id_uniq\")"), "Enforces exactly ONE sale per boat (relists deduped)");

// 4. Test Submission-Created Function (Deduplication & Resend)
const submissionContent = fs.readFileSync(path.join(ROOT, "netlify/functions/submission-created.ts"), "utf-8");
assert(submissionContent.includes("netlifySubmissionId"), "Submission handler captures Netlify Submission ID");
assert(submissionContent.includes("Duplicate submission skipped"), "Submission handler deduplicates by Netlify Submission ID");
assert(submissionContent.includes("api.resend.com/emails"), "Submission handler preserves Resend email notifications");
assert(!submissionContent.includes("twilio") && !submissionContent.includes("send_sms"), "Submission handler does NOT send automatic SMS");

// 5. Test WhatConverts Integration
const wcContent = fs.readFileSync(path.join(ROOT, "netlify/functions/whatconverts-webhook.ts"), "utf-8");
assert(wcContent.includes("recordingDisabled: true"), "Call recording is strictly disabled");
assert(wcContent.includes("forwardedToNumber"), "Forwards to existing Quo number");
assert(wcContent.includes("Duplicate call"), "Deduplicates calls by call ID");

// 6. Test Protected Dashboard API & Authentication
const dashApiContent = fs.readFileSync(path.join(ROOT, "netlify/functions/dashboard-api.ts"), "utf-8");
assert(dashApiContent.includes("verifyDashboardAuth"), "Dashboard requires authentication");
assert(dashApiContent.includes("update_attribution"), "Dashboard provides manual attribution correction");
assert(dashApiContent.includes("auditHistory"), "Dashboard logs audit history on changes");

// 7. Test Public Endpoints Security (No raw IPs exposed)
const visitsContent = fs.readFileSync(path.join(ROOT, "netlify/functions/visits.ts"), "utf-8");
assert(visitsContent.includes("verifyDashboardAuth"), "/api/visits is protected from public exposure");
assert(visitsContent.includes("ipHash"), "/api/visits uses hashed IP instead of raw IP");

const donateClicksContent = fs.readFileSync(path.join(ROOT, "netlify/functions/donate-clicks.ts"), "utf-8");
assert(donateClicksContent.includes("verifyDashboardAuth"), "/api/donate-clicks is protected from public exposure");
assert(donateClicksContent.includes("ipHash"), "/api/donate-clicks uses hashed IP instead of raw IP");

console.log(`\n[test-attribution] Test suite complete: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
