// netlify/functions/submission-created.ts
import type { Handler } from "@netlify/functions";
import { db } from "../../db/index.js";
import { leads, events, visitors, sessions } from "../../db/schema.js";
import { runMigrations } from "../../db/migrate.js";
import { sha256 } from "../../lib/attribution.js";
import { eq } from "drizzle-orm";

let migrated = false;

export const handler: Handler = async (event) => {
  console.log("[submission-created] Triggered");
  
  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (e) {
      console.warn("[submission-created] migration warning:", e);
    }
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const submission = payload && payload.payload ? payload.payload : {};
    const data = submission.data || {};
    const formName = submission.form_name || data["form-name"] || "donationForm";
    const netlifySubmissionId = submission.id || data.id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const donorEmail = (data.email || "").trim();
    const donorPhone = (data.phone || "").trim();
    const firstName = (data.first_name || data.name || "").trim();
    const lastName = (data.last_name || "").trim();
    const boatDetails = (data.boat_details || data.details || data.notes || "").trim();
    const smsConsent = data.sms_consent === "yes" || data.sms_consent === "true" || data.sms_consent === true;
    const pageContext = (data.page_context || "").trim();

    // Attribution inputs
    const visitorId = (data.visitor_id || "").trim();
    const sessionId = (data.session_id || "").trim();
    const firstTouchSource = (data.first_touch_source || "").trim();
    const firstTouchMedium = (data.first_touch_medium || "").trim();
    const firstTouchCampaign = (data.first_touch_campaign || "").trim();
    const firstTouchLandingPage = (data.first_touch_landing_page || "").trim();
    
    const lastTouchSource = (data.last_touch_source || data.utm_source || "").trim();
    const lastTouchMedium = (data.last_touch_medium || data.utm_medium || "").trim();
    const lastTouchCampaign = (data.last_touch_campaign || data.utm_campaign || "").trim();
    const lastTouchTerm = (data.last_touch_term || data.utm_term || "").trim();
    const lastTouchContent = (data.last_touch_content || data.utm_content || "").trim();
    const lastLandingPage = (data.last_landing_page || "").trim();
    const lastReferrer = (data.last_referrer || "").trim();

    const gclid = (data.gclid || "").trim();
    const gbraid = (data.gbraid || "").trim();
    const wbraid = (data.wbraid || "").trim();
    const msclkid = (data.msclkid || "").trim();
    const gaClientId = (data.ga_client_id || "").trim();

    // 1. DEDUPLICATION: Check if Netlify Submission ID already processed
    const existing = await db.select().from(leads).where(eq(leads.netlifySubmissionId, netlifySubmissionId)).limit(1);
    if (existing.length > 0) {
      console.log(`[submission-created] Duplicate submission ${netlifySubmissionId} skipped.`);
      return { statusCode: 200, body: "Duplicate submission skipped" };
    }

    // 2. CREATE EXACTLY ONE LEAD IN DATABASE
    const [newLead] = await db.insert(leads).values({
      netlifySubmissionId,
      formName,
      visitorId: visitorId || null,
      sessionId: sessionId || null,
      firstName,
      lastName,
      email: donorEmail,
      phone: donorPhone,
      smsConsent,
      boatDetails,
      pageContext,
      stage: "New",
      firstTouchSource,
      firstTouchMedium,
      firstTouchCampaign,
      firstTouchLandingPage,
      lastTouchSource,
      lastTouchMedium,
      lastTouchCampaign,
      lastTouchTerm,
      lastTouchContent,
      lastLandingPage,
      lastReferrer,
      gclid,
      gbraid,
      wbraid,
      msclkid,
      gaClientId,
      rawFormData: data
    }).returning();

    // 3. LOG VERIFIED LEAD EVENT
    if (visitorId) {
      await db.insert(events).values({
        visitorId,
        sessionId: sessionId || null,
        eventName: "verified_lead",
        pagePath: lastLandingPage || "/",
        source: lastTouchSource || "direct",
        metadata: { lead_id: newLead.id, form_name: formName }
      });
    }

    // 4. PRESERVE EXISTING RESEND AUTO-REPLY WORKFLOW
    // Note: NEVER send an automatic SMS (per nonnegotiable requirement)
    if (donorEmail && (formName === "donationForm" || formName === "boatValuation")) {
      const isValuation = formName === "boatValuation";
      const subject = isValuation
        ? "We received your boat valuation request — Boats for Charity"
        : "We received your boat donation information — Boats for Charity";
      
      const html = isValuation
        ? `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin:0 0 8px;color:#0b243b">Your boat valuation is being prepared</h2>
          <p>Thanks! We received your boat information. Our team will review the details you provided along with available market information to prepare an estimated market range for your boat.</p>
          <p>Please allow 1–2 business days to receive your valuation report. If you need help sooner, call <a href="tel:+18555573703">(855) 557-3703</a>.</p>
          <p style="margin:16px 0 0">&mdash; Boats for Charity<br><em>Turning Boats into Blessings</em></p>
        </div>
      `
        : `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin:0 0 8px;color:#0b243b">Thank you for your submission</h2>
          <p>We received your boat donation information and will reach out shortly. If you need help now, call <a href="tel:+18555573703">(855) 557-3703</a>.</p>
          <p style="margin:16px 0 0">&mdash; Boats for Charity<br><em>Turning Boats into Blessings</em></p>
        </div>
      `;

      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const FROM_EMAIL = process.env.FROM_EMAIL || "Boats for Charity <no-reply@boatsforcharity.org>";

      if (RESEND_API_KEY) {
        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: donorEmail,
              subject,
              html
            })
          });
          if (!resp.ok) {
            console.error("[submission-created] Resend error:", await resp.text());
          } else {
            console.log("[submission-created] Resend notification sent successfully");
          }
        } catch (resendErr) {
          console.error("[submission-created] Resend network error:", resendErr);
        }
      } else {
        console.warn("[submission-created] RESEND_API_KEY not set — skipping email auto-reply.");
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Lead created and linked", leadId: newLead.id })
    };
  } catch (err) {
    console.error("[submission-created] Fatal function error:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
