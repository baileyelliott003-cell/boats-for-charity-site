// netlify/functions/google-ads-conversions-feed.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { conversionExports } from "../../db/schema.js";
import { runMigrations } from "../../db/migrate.js";
import { verifyGoogleAdsFeedAuth, hashEmail, hashPhone } from "../../lib/attribution.js";
import { desc, gte } from "drizzle-orm";

let migrated = false;

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
export default async (req: Request, context: Context) => {
  // 1. Verify HTTP Basic Authentication
  const authHeader = req.headers.get("authorization");
  if (!verifyGoogleAdsFeedAuth(authHeader)) {
    return new Response("Unauthorized: Valid HTTP Basic Auth required for Google Ads Conversion Feed", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Google Ads Data Manager Conversion Feed"',
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  // Ensure migrations are in place
  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (e) {
      console.warn("[google-ads-conversions-feed] migration warning:", e);
    }
  }

  try {
    // Google Ads click-through conversion window is up to 60/90 days
    // Include conversions from the last 60 days to ensure data freshness while staying within Google's accepted upload window
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const allConversions = await db
      .select()
      .from(conversionExports)
      .where(gte(conversionExports.conversionTime, sixtyDaysAgo))
      .orderBy(desc(conversionExports.conversionTime));

    // Filter legitimate pipeline events only: Must have either GCLID/GBRAID/WBRAID or matchable hashed customer data
    const eligibleConversions = allConversions.filter((c) => {
      const hasClickId = Boolean(c.gclid || c.gbraid || c.wbraid);
      const hasHashedContact = Boolean(c.hashedEmail || c.hashedPhone);
      return hasClickId || hasHashedContact;
    });

    // Standard Google Ads Data Manager CSV Format
    const headers = [
      "Conversion Name",
      "Conversion Time",
      "Order ID",
      "Google Click ID",
      "GBRAID",
      "WBRAID",
      "Hashed Email",
      "Hashed Phone Number",
      "Conversion Value",
      "Conversion Currency"
    ];

    const rows = eligibleConversions.map((c) => {
      // Format time as yyyy-mm-dd hh:mm:ss+00:00 (compliant ISO/UTC format)
      const timeStr = c.conversionTime
        .toISOString()
        .replace(/T/, " ")
        .replace(/\..+/, "+00:00");

      // Map exact conversion action names matching Google Ads setup
      let conversionName = c.conversionType;
      if (c.conversionType === "Donation_Accepted") conversionName = "Donation_Accepted";
      else if (c.conversionType === "Boat_Sold") conversionName = "Boat_Sold";
      else if (c.conversionType === "Qualified_Lead") conversionName = "Qualified_Lead";

      // Value formatting: Actual gross sale amount for Boat_Sold, 0.0 for others
      let value = c.conversionValue || "0";
      if (c.conversionType === "Boat_Sold") {
        value = Number(c.conversionValue || 0).toFixed(2);
      }

      const emailHash = hashEmail(c.hashedEmail);
      const phoneHash = hashPhone(c.hashedPhone);

      return [
        conversionName,
        timeStr,
        c.conversionId, // Stable unique Order ID for deduplication
        c.gclid || "",
        c.gbraid || "",
        c.wbraid || "",
        emailHash,
        phoneHash,
        value,
        c.currency || "USD"
      ];
    });

    const csvContent = [
      "Parameters:TimeZone=UTC",
      headers.join(","),
      ...rows.map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
    ].join("\r\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": 'inline; filename="google-ads-conversions-feed.csv"'
      }
    });
  } catch (err: any) {
    console.error("[google-ads-conversions-feed] Error:", err);
    return new Response("Internal error generating conversion feed", {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }
};

export const config: Config = {
  path: ["/api/google-ads-conversions-feed.csv", "/api/google-ads-conversions-feed"],
};
