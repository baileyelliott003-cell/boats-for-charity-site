// netlify/functions/export-conversions.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { conversionExports, auditHistory } from "../../db/schema.js";
import { runMigrations } from "../../db/migrate.js";
import { verifyDashboardAuth } from "../../lib/attribution.js";
import { eq, and, isNotNull } from "drizzle-orm";

let migrated = false;

/**
 * Google Ads Enhanced & Offline Conversion Export Helper
 * Securely authenticated via Authorization / session headers (without query string keys)
 * Delivers conversion data ready for Google Ads Offline Conversions API / Bulk Upload
 */
export default async (req: Request, context: Context) => {
  const authHeader = req.headers.get("authorization") || req.headers.get("x-dashboard-key");
  if (!verifyDashboardAuth(authHeader)) {
    return new Response(JSON.stringify({ error: "Unauthorized access to conversion exports" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (e) {
      console.warn("[export-conversions] migration warning:", e);
    }
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json"; // json | csv

  try {
    // Fetch pending conversions
    const pending = await db
      .select()
      .from(conversionExports)
      .where(eq(conversionExports.exportStatus, "Pending"));

    if (format === "csv") {
      // Google Ads Offline Conversion CSV Template Standard
      const headers = [
        "Google Click ID",
        "Conversion Name",
        "Conversion Time",
        "Conversion Value",
        "Conversion Currency",
        "GBRAID",
        "WBRAID",
        "Order ID / Conversion ID",
        "Hashed Email",
        "Hashed Phone"
      ];

      const rows = pending.map((c) => [
        c.gclid || "",
        c.conversionType === "Donation_Accepted" ? "Donation Accepted (Primary)" : (c.conversionType === "Boat_Sold" ? "Boat Sold (Value)" : "Qualified Lead"),
        c.conversionTime.toISOString().replace(/T/, " ").replace(/\..+/, "+0000"),
        c.conversionValue || "1.0",
        c.currency || "USD",
        c.gbraid || "",
        c.wbraid || "",
        c.conversionId,
        c.hashedEmail || "",
        c.hashedPhone || ""
      ]);

      const csvContent = [
        "Parameters:TimeZone=UTC",
        headers.join(","),
        ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\r\n");

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="google_ads_conversions_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return Response.json({ pendingCount: pending.length, conversions: pending });
  } catch (err: any) {
    console.error("[export-conversions] error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config: Config = {
  path: "/api/export-conversions",
};
