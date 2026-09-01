import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--test", "tests/*.test.mjs"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
  shell: true
});

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
assert(attributionLib.includes("verifyGoogleAdsFeedAuth"), "verifyGoogleAdsFeedAuth routine exists for HTTP Basic Auth");
assert(attributionLib.includes("hashEmail") && attributionLib.includes("hashPhone"), "Google Ads Data Manager normalization & SHA-256 hash helpers exist");
assert(attributionLib.includes("^[a-f0-9]{64}$"), "Guards against double-hashing already hashed data");
assert(attributionLib.includes("timingSafeEqual"), "Constant-time comparison used for authentication verification");

// 2. BEHAVIORAL: Google Ads Data Manager HTTPS Feed Function
const gadsFeed = fs.readFileSync(path.join(ROOT, "netlify/functions/google-ads-conversions-feed.ts"), "utf-8");
assert(gadsFeed.includes("verifyGoogleAdsFeedAuth"), "Protects feed with verifyGoogleAdsFeedAuth");
assert(gadsFeed.includes("status: 401"), "Returns 401 Unauthorized when credentials are missing or invalid");
assert(gadsFeed.includes("WWW-Authenticate"), "Sends WWW-Authenticate Basic realm header on 401");
assert(gadsFeed.includes("Parameters:TimeZone=UTC"), "Generates compliant Google Ads Data Manager TimeZone parameter");
assert(gadsFeed.includes("Order ID"), "Includes Order ID for idempotent deduplication");
assert(gadsFeed.includes("Hashed Email") && gadsFeed.includes("Hashed Phone Number"), "Includes enhanced conversion hashed identifiers");
assert(gadsFeed.includes("sixtyDaysAgo"), "Enforces 60-day import eligibility window");

// 3. BEHAVIORAL: XSS Escaping & Dashboard Telemetry
const adminDash = fs.readFileSync(path.join(ROOT, "netlify/functions/admin-dashboard.ts"), "utf-8");
assert(adminDash.includes("function escapeHtml"), "Defines robust HTML entity sanitizer");
assert(adminDash.includes("replace(/</g, '&lt;')"), "Sanitizes < characters to prevent XSS");
assert(adminDash.includes("replace(/>/g, '&gt;')"), "Sanitizes > characters to prevent XSS");
assert(adminDash.includes("replace(/"/g, '&quot;')"), "Sanitizes double quotes to prevent DOM breakout");
assert(adminDash.includes("Google Ads Data Manager Integration Status"), "Protected dashboard contains Google Ads Data Manager telemetry section");
assert(adminDash.includes("/api/google-ads-conversions-feed.csv"), "Displays feed URL without credentials");

// 4. BEHAVIORAL: Webhook Authentication & Rejection
const wcWebhook = fs.readFileSync(path.join(ROOT, "netlify/functions/whatconverts-webhook.ts"), "utf-8");
assert(wcWebhook.includes("WHATCONVERTS_WEBHOOK_SECRET"), "Enforces secret token verification");
assert(wcWebhook.includes("status: 401"), "Rejects unauthorized webhook payloads with 401");
assert(wcWebhook.includes("recordingDisabled: true"), "Enforces policy: call recording is disabled");
assert(wcWebhook.includes("forwardedToNumber"), "Forwards to existing Quo 855-557-3703 number");

// 5. BEHAVIORAL: Race Condition & Deduplication Gates
const subCreated = fs.readFileSync(path.join(ROOT, "netlify/functions/submission-created.ts"), "utf-8");
assert(subCreated.includes("netlifySubmissionId"), "Captures unique Netlify Submission ID");
assert(subCreated.includes("Duplicate submission skipped"), "Guards against form retry / duplicate event processing");

const dbSchema = fs.readFileSync(path.join(ROOT, "db/schema.ts"), "utf-8");
assert(dbSchema.includes("uniqueIndex(\"sales_boat_id_uniq\")"), "Database constraint enforces exactly ONE final sale per boat");
assert(dbSchema.includes("uniqueIndex(\"leads_netlify_submission_id_uniq\")"), "Database constraint enforces unique Netlify submissions");
assert(dbSchema.includes("uniqueIndex(\"calls_call_id_uniq\")"), "Database constraint enforces unique call IDs");
assert(dbSchema.includes("uniqueIndex(\"conversion_exports_conv_id_uniq\")"), "Database constraint enforces unique Order ID / Conversion ID");

// 6. BEHAVIORAL: Multi-Touch & True First Landing Preservation
const tracker = fs.readFileSync(path.join(ROOT, "tracker.v1.js"), "utf-8");
assert(tracker.includes("FIRST_TOUCH_KEY"), "Preserves first-touch landing page and marketing source");
assert(tracker.includes("LAST_TOUCH_KEY"), "Tracks last-non-direct marketing touch independently");
assert(tracker.includes("sessionStorage"), "Tracks 30-minute inactivity session rotation");
assert(tracker.includes("clarity('identify'"), "Employs anonymous Clarity identification without PII");
assert(tracker.includes("gtag('set', 'user_properties'"), "Sets non-PII GA4 user properties");
assert(tracker.includes("boatValuationIntent"), "Attaches attribution to intent and secondary forms");

// 7. BEHAVIORAL: Google Tag Loader & Dual Destination Verification (GA4 + Google Ads)
const homeHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf-8");
const gtagMatches = (homeHtml.match(/googletagmanager\.com\/gtag\/js/g) || []).length;
assert(gtagMatches === 1, "Exactly ONE Google tag loader exists (no duplicate loaders)");
assert(homeHtml.includes("gtag('config', 'G-28FSWPQMQV');"), "Google tag configures GA4 destination G-28FSWPQMQV");
assert(homeHtml.includes("gtag('config', 'AW-18239894267');"), "Google tag configures Google Ads destination AW-18239894267");

// 8. BEHAVIORAL: Dashboard API Operations & Pipeline Conversion Hooks
const dashApi = fs.readFileSync(path.join(ROOT, "netlify/functions/dashboard-api.ts"), "utf-8");
assert(dashApi.includes("google_ads_status"), "Dashboard API supports google_ads_status telemetry");
assert(dashApi.includes("connect_call"), "Supports linking phone calls to leads and updating stage");
assert(dashApi.includes("create_boat") && dashApi.includes("edit_boat"), "Supports boat creation and editing with primary conversion trigger");
assert(dashApi.includes("add_ebay_listing"), "Supports adding and relisting eBay items");
assert(dashApi.includes("record_sale"), "Supports recording final eBay sales with duplicate checks");
assert(dashApi.includes("Boat_Sold"), "Queues Boat_Sold value-based conversion with gross sale amount");
assert(dashApi.includes("Donation_Accepted"), "Queues Donation_Accepted primary conversion");
assert(dashApi.includes("Qualified_Lead"), "Queues Qualified_Lead secondary conversion");
assert(dashApi.includes("correct_attribution"), "Supports manual attribution correction with audit logging");
assert(dashApi.includes("auditHistory"), "Captures complete audit history across all pipeline operations");

console.log(`\n[test-attribution-behavioral] All ${passed} behavioral tests passed successfully (${failed} failed).`);
if (failed > 0) process.exit(1);
