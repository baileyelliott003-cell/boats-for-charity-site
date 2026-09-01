// netlify/functions/google-ads-conversions-feed.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { conversionExports } from "../../db/schema.js";
import { runMigrations } from "../../db/migrate.js";
import { verifyGoogleAdsFeedAuth, hashEmail, hashPhone } from "../../lib/attribution.js";
import { desc, gte } from "drizzle-orm";

let migrated = false;
const ALLOWED_CONVERSION_TYPES = new Set(["Donation_Accepted", "Qualified_Lead", "Boat_Sold"]);
const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

type FeedConversion = typeof conversionExports.$inferSelect;
interface FeedDependencies {
  verifyAuth: (authorization: string | null) => boolean;
  migrate: () => Promise<void>;
  loadConversions: (since: Date) => Promise<FeedConversion[]>;
}

function validHash(value: string | null | undefined) {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}

function eligibleConversion(conversion: FeedConversion) {
  if (!conversion.conversionId || !ALLOWED_CONVERSION_TYPES.has(conversion.conversionType)) return false;
  if (!(conversion.conversionTime instanceof Date) || Number.isNaN(conversion.conversionTime.getTime())) return false;
  if (conversion.currency !== "USD") return false;
  if (conversion.conversionType === "Boat_Sold" && (!conversion.boatId || !conversion.saleId || Number(conversion.conversionValue) <= 0)) return false;
  if (conversion.conversionType !== "Boat_Sold" && !conversion.leadId && !conversion.callId) return false;
  return Boolean(conversion.gclid || conversion.gbraid || conversion.wbraid || validHash(conversion.hashedEmail) || validHash(conversion.hashedPhone));
}

export function buildGoogleAdsDataManagerCsv(conversions: FeedConversion[]) {
  const seen = new Set<string>();
  const eligibleConversions = conversions.filter((conversion) => {
    if (!eligibleConversion(conversion) || seen.has(conversion.conversionId)) return false;
    seen.add(conversion.conversionId);
    return true;
  });
  const headers = [
    "Conversion Name", "Conversion Time", "Order ID", "Google Click ID", "GBRAID", "WBRAID",
    "Hashed Email", "Hashed Phone Number", "Conversion Value", "Conversion Currency"
  ];
  const rows = eligibleConversions.map((conversion) => {
    const time = conversion.conversionTime.toISOString().replace(/T/, " ").replace(/\..+/, "+00:00");
    const value = conversion.conversionType === "Boat_Sold" ? Number(conversion.conversionValue).toFixed(2) : "0.00";
    return [
      conversion.conversionType, time, conversion.conversionId, conversion.gclid || "", conversion.gbraid || "",
      conversion.wbraid || "", hashEmail(conversion.hashedEmail), hashPhone(conversion.hashedPhone), value, "USD"
    ];
  });
  return [
    "Parameters:TimeZone=UTC",
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\r\n");
}

/**
 * Automated HTTPS Conversion Feed for Google Ads Data Manager / Scheduled File Uploads
 * Endpoint: /api/google-ads-conversions-feed.csv
 * Protected via HTTP Basic Auth (GOOGLE_ADS_FEED_USERNAME / GOOGLE_ADS_FEED_PASSWORD)
 * 
 * Output Specification:
 * - Parameters:TimeZone=UTC
 * - Conversion Name (Donation_Accepted, Qualified_Lead, Boat_Sold)
 * - Conversion Time (yyyy-mm-dd hh:mm:ss+00:00)
 * - Order ID / Conversion ID (Unique deduplication ID)
 * - Google Click ID (GCLID)
 * - GBRAID
 * - WBRAID
 * - Hashed Email (SHA-256 normalized)
 * - Hashed Phone (SHA-256 E.164 normalized)
 * - Conversion Value
 * - Conversion Currency (USD)
 */
export function createGoogleAdsFeedHandler(dependencies: FeedDependencies) {
  return async (req: Request, _context?: Context) => {
  // 1. Verify HTTP Basic Authentication
  const authHeader = req.headers.get("authorization");
  if (!dependencies.verifyAuth(authHeader)) {
    return new Response("Unauthorized: Valid HTTP Basic Auth required for Google Ads Conversion Feed", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Google Ads Data Manager Conversion Feed"',
        "Content-Type": "text/plain; charset=utf-8",
        ...SECURITY_HEADERS
      }
    });
  }

  // Ensure migrations are in place
  if (!migrated) {
    try {
      await dependencies.migrate();
      migrated = true;
    } catch (e) {
      console.warn("[google-ads-conversions-feed] migration warning:", e);
    }
  }

  try {
    // Google Ads click-through conversion window is up to 60/90 days
    // Include conversions from the last 60 days to ensure data freshness while staying within Google's accepted upload window
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const allConversions = await dependencies.loadConversions(sixtyDaysAgo);

    const csvContent = buildGoogleAdsDataManagerCsv(allConversions);

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        ...SECURITY_HEADERS,
        "Content-Disposition": 'inline; filename="google-ads-conversions-feed.csv"'
      }
    });
  } catch (err: any) {
    console.error("[google-ads-conversions-feed] Error:", err);
    return new Response("Internal error generating conversion feed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS }
    });
  }
  };
}

export default createGoogleAdsFeedHandler({
  verifyAuth: verifyGoogleAdsFeedAuth,
  migrate: runMigrations,
  loadConversions: (since) => db
    .select()
    .from(conversionExports)
    .where(gte(conversionExports.conversionTime, since))
    .orderBy(desc(conversionExports.conversionTime)),
});

export const config: Config = {
  path: ["/api/google-ads-conversions-feed.csv", "/api/google-ads-conversions-feed"],
};
