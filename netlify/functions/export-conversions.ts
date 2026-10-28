// netlify/functions/export-conversions.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { conversionExports, sales } from "../../db/schema.js";
import { verifiedPaidSale } from "../../lib/paid-sale.js";
import { buildGoogleAdsDataManagerCsv } from "./google-ads-conversions-feed.js";
import { authorizeAdminRequest } from "../../lib/admin-auth.js";
import { eq, and, isNotNull } from "drizzle-orm";

/**
 * Google Ads Enhanced & Offline Conversion Export Helper
 * Securely authenticated by the server-side dashboard session cookie.
 * Delivers conversion data ready for Google Ads Offline Conversions API / Bulk Upload
 */
export default async (req: Request, context: Context) => {
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.authorized) {
    return new Response(JSON.stringify({ error: authorization.error }), {
      status: authorization.status,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json"; // json | csv

  try {
    // Fetch pending conversions
    const pendingRows = await db
      .select({ conversion: conversionExports, sale: sales })
      .from(conversionExports)
      .leftJoin(sales, eq(conversionExports.saleId, sales.id))
      .where(eq(conversionExports.exportStatus, "Pending"));
    const pending = pendingRows.map(({ conversion, sale }) => ({ ...conversion,
      paymentVerified: verifiedPaidSale(sale) && sale?.boatId === conversion.boatId
        && Number(sale.saleAmount) === Number(conversion.conversionValue),
    })).filter(c => c.conversionType !== 'Boat_Sold' || c.paymentVerified);

    if (format === "csv") {
      // Same names, values and payment gates as the scheduled feed.
      const csvContent = buildGoogleAdsDataManagerCsv(pending);

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
