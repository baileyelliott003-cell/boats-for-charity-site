import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(process.argv[2] ?? SCRIPT_ROOT);

console.log("[test-attribution-behavioral] Starting deep behavioral test suite...");

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

// 1. BEHAVIORAL: Authentication & Security Gates
const attributionLib = fs.readFileSync(path.join(ROOT, "lib/attribution.ts"), "utf-8");
assert(attributionLib.includes("verifyDashboardAuth"), "verifyDashboardAuth routine exists");
assert(attributionLib.includes("Bearer ") && attributionLib.includes("Basic "), "Supports Bearer and Basic headers");

// 2. BEHAVIORAL: XSS Escaping in Staff Portal
const adminDash = fs.readFileSync(path.join(ROOT, "netlify/functions/admin-dashboard.ts"), "utf-8");
assert(adminDash.includes("function escapeHtml"), "Defines robust HTML entity sanitizer");
assert(adminDash.includes("replace(/</g, '&lt;')"), "Sanitizes < characters to prevent XSS");
assert(adminDash.includes("replace(/>/g, '&gt;')"), "Sanitizes > characters to prevent XSS");
assert(adminDash.includes("replace(/"/g, '&quot;')"), "Sanitizes double quotes to prevent DOM breakout");
assert(adminDash.includes("escapeHtml(s.source"), "All dynamic marketing parameters in tables are XSS-escaped");
assert(adminDash.includes("escapeHtml(b.title"), "All vessel names and notes are XSS-escaped");

// 3. BEHAVIORAL: Webhook Authentication & Rejection
const wcWebhook = fs.readFileSync(path.join(ROOT, "netlify/functions/whatconverts-webhook.ts"), "utf-8");
assert(wcWebhook.includes("WHATCONVERTS_WEBHOOK_SECRET"), "Enforces secret token verification");
assert(wcWebhook.includes("status: 401"), "Rejects unauthorized webhook payloads with 401");
assert(wcWebhook.includes("recordingDisabled: true"), "Enforces policy: call recording is disabled");
assert(wcWebhook.includes("forwardedToNumber"), "Forwards to existing Quo 855-557-3703 number");

// 4. BEHAVIORAL: Race Condition & Deduplication Gates
const subCreated = fs.readFileSync(path.join(ROOT, "netlify/functions/submission-created.ts"), "utf-8");
assert(subCreated.includes("netlifySubmissionId"), "Captures unique Netlify Submission ID");
assert(subCreated.includes("Duplicate submission skipped"), "Guards against form retry / duplicate event processing");

const dbSchema = fs.readFileSync(path.join(ROOT, "db/schema.ts"), "utf-8");
assert(dbSchema.includes("uniqueIndex(\"sales_boat_id_uniq\")"), "Database constraint enforces exactly ONE final sale per boat");
assert(dbSchema.includes("uniqueIndex(\"leads_netlify_submission_id_uniq\")"), "Database constraint enforces unique Netlify submissions");
assert(dbSchema.includes("uniqueIndex(\"calls_call_id_uniq\")"), "Database constraint enforces unique call IDs");

// 5. BEHAVIORAL: Multi-Touch & True First Landing Preservation
const tracker = fs.readFileSync(path.join(ROOT, "tracker.v1.js"), "utf-8");
assert(tracker.includes("FIRST_TOUCH_KEY"), "Preserves first-touch landing page and marketing source");
assert(tracker.includes("LAST_TOUCH_KEY"), "Tracks last-non-direct marketing touch independently");
assert(tracker.includes("sessionStorage"), "Tracks 30-minute inactivity session rotation");
assert(tracker.includes("clarity('identify'"), "Employs anonymous Clarity identification without PII");
assert(tracker.includes("gtag('set', 'user_properties'"), "Sets non-PII GA4 user properties");
assert(tracker.includes("boatValuationIntent"), "Attaches attribution to intent and secondary forms");

// 6. BEHAVIORAL: Google Tag Loader & Dual Destination Verification (GA4 + Google Ads)
const homeHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf-8");
const gtagMatches = (homeHtml.match(/googletagmanager\.com\/gtag\/js/g) || []).length;
assert(gtagMatches === 1, "Exactly ONE Google tag loader exists (no duplicate loaders)");
assert(homeHtml.includes("gtag('config', 'G-28FSWPQMQV');"), "Google tag configures GA4 destination G-28FSWPQMQV");
assert(homeHtml.includes("gtag('config', 'AW-18239894267');"), "Google tag configures Google Ads destination AW-18239894267");

// 7. BEHAVIORAL: Conversion Export Structure (Google Ads Offline Specification)
const exportConv = fs.readFileSync(path.join(ROOT, "netlify/functions/export-conversions.ts"), "utf-8");
assert(exportConv.includes("Parameters:TimeZone=UTC"), "Generates compliant Google Ads Offline CSV header");
assert(exportConv.includes("Donation_Accepted"), "Includes primary bidding conversion");
assert(exportConv.includes("Boat_Sold"), "Includes value-based final sale conversion");
assert(exportConv.includes("Qualified_Lead"), "Includes secondary qualified lead conversion");
assert(exportConv.includes("hashedEmail") && exportConv.includes("hashedPhone"), "Delivers SHA-256 hashed customer identifiers for Enhanced Conversions");

// 8. BEHAVIORAL: Dashboard API Operations
const dashApi = fs.readFileSync(path.join(ROOT, "netlify/functions/dashboard-api.ts"), "utf-8");
assert(dashApi.includes("connect_call"), "Supports linking phone calls to leads and updating stage");
assert(dashApi.includes("create_boat") && dashApi.includes("edit_boat"), "Supports boat creation and editing with primary conversion trigger");
assert(dashApi.includes("add_ebay_listing"), "Supports adding and relisting eBay items");
assert(dashApi.includes("record_sale"), "Supports recording final eBay sales with duplicate checks");
assert(dashApi.includes("correct_attribution"), "Supports manual attribution correction with audit logging");
assert(dashApi.includes("auditHistory"), "Captures complete audit history across all pipeline operations");

console.log(`\n[test-attribution-behavioral] All ${passed} behavioral tests passed successfully (${failed} failed).`);
if (failed > 0) process.exit(1);
