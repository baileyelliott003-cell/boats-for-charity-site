// netlify/functions/admin-backfill.ts
import type { Config, Context } from "@netlify/functions";
import { authorizeAdminRequest } from "../../lib/admin-auth.js";
import { postgresNetlifySubmissionRepository } from "../../lib/netlify-submission.js";
import { getRuntimeEnv } from "../../lib/runtime-env.js";
import { runMigrations } from "../../db/migrate.js";

let migrated = false;

/**
 * Protected Staff Backfill Endpoint
 * Fetches verified form submissions via the Netlify API and safely backfills them into the persistent database.
 */
export default async (req: Request, context: Context) => {
  const authorization = await authorizeAdminRequest(req, { requireCsrf: true });
  if (!authorization.authorized) {
    return new Response(JSON.stringify({ error: authorization.error }), {
      status: authorization.status,
      headers: { "Content-Type": "application/json", "cache-control": "no-store" }
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "allow": "POST" }
    });
  }

  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (e) {
      console.warn("[admin-backfill] migration warning:", e);
    }
  }

  const netlifyToken = getRuntimeEnv("NETLIFY_AUTH_TOKEN") || getRuntimeEnv("NETLIFY_API_TOKEN") || getRuntimeEnv("NETLIFY_TOKEN");
  const siteId = getRuntimeEnv("NETLIFY_SITE_ID") || getRuntimeEnv("SITE_ID");

  if (!netlifyToken || !siteId) {
    return new Response(JSON.stringify({ 
      error: "Netlify API token or Site ID environment variable is not configured for automatic backfill.",
      scanned: 0,
      inserted: 0,
      skipped: 0,
      failed: 0
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Fetch verified form submissions for supported forms from Netlify API
    const formsResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: { Authorization: `Bearer ${netlifyToken}` }
    });

    if (!formsResponse.ok) {
      throw new Error(`Netlify API returned status ${formsResponse.status} while fetching forms`);
    }

    const formsList = await formsResponse.json();
    const supportedForms = formsList.filter((f: any) => ["donationForm", "boatValuation", "boatValuationIntent"].includes(f.name));

    let scanned = 0;
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const insertedIds: number[] = [];

    for (const form of supportedForms) {
      const submissionsResponse = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, {
        headers: { Authorization: `Bearer ${netlifyToken}` }
      });

      if (!submissionsResponse.ok) continue;

      const submissions = await submissionsResponse.json();
      for (const sub of submissions) {
        scanned++;
        try {
          const normalized = {
            netlifySubmissionId: String(sub.id).trim(),
            formName: form.name,
            visitorId: String(sub.data?.visitor_id || "").trim(),
            sessionId: String(sub.data?.session_id || "").trim(),
            firstName: String(sub.data?.first_name || sub.data?.name || "").trim().slice(0, 150),
            lastName: String(sub.data?.last_name || "").trim().slice(0, 150),
            email: String(sub.data?.email || "").trim().toLowerCase().slice(0, 320),
            phone: String(sub.data?.phone || "").trim().slice(0, 50),
            smsConsent: sub.data?.sms_consent === true || sub.data?.sms_consent === "true" || sub.data?.sms_consent === "yes",
            boatDetails: String(sub.data?.boat_details || sub.data?.details || sub.data?.notes || "").trim().slice(0, 5000),
            pageContext: String(sub.data?.page_context || "").trim().slice(0, 500),
            firstTouchSource: String(sub.data?.first_touch_source || "").trim().slice(0, 150),
            firstTouchMedium: String(sub.data?.first_touch_medium || "").trim().slice(0, 150),
            firstTouchCampaign: String(sub.data?.first_touch_campaign || "").trim().slice(0, 150),
            firstTouchLandingPage: String(sub.data?.first_touch_landing_page || "").trim().slice(0, 500),
            lastTouchSource: String(sub.data?.last_touch_source || sub.data?.utm_source || "direct").trim().slice(0, 150),
            lastTouchMedium: String(sub.data?.last_touch_medium || sub.data?.utm_medium || "").trim().slice(0, 150),
            lastTouchCampaign: String(sub.data?.last_touch_campaign || sub.data?.utm_campaign || "").trim().slice(0, 150),
            lastTouchTerm: String(sub.data?.last_touch_term || sub.data?.utm_term || "").trim().slice(0, 150),
            lastTouchContent: String(sub.data?.last_touch_content || sub.data?.utm_content || "").trim().slice(0, 150),
            lastLandingPage: String(sub.data?.last_landing_page || "/").trim().slice(0, 500),
            lastReferrer: String(sub.data?.last_referrer || "").trim().slice(0, 500),
            gclid: String(sub.data?.gclid || "").trim().slice(0, 200),
            gbraid: String(sub.data?.gbraid || "").trim().slice(0, 150),
            wbraid: String(sub.data?.wbraid || "").trim().slice(0, 150),
            msclkid: String(sub.data?.msclkid || "").trim().slice(0, 150),
            gaClientId: String(sub.data?.ga_client_id || "").trim().slice(0, 100),
            rawFormData: sub.data || {}
          };

          const result = await postgresNetlifySubmissionRepository.createLead(normalized);
          if (result.created) {
            inserted++;
            insertedIds.push(result.leadId);
          } else {
            skipped++;
          }
        } catch (subErr) {
          console.error("[admin-backfill] Failed processing submission", sub.id, subErr);
          failed++;
        }
      }
    }

    return Response.json({
      success: true,
      scanned,
      inserted,
      skipped,
      failed,
      insertedIds
    });
  } catch (err: any) {
    console.error("[admin-backfill] Error executing backfill:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config: Config = {
  path: "/api/admin-backfill",
};
