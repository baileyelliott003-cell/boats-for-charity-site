// netlify/functions/whatconverts-webhook.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { calls, visitors, events } from "../../db/schema.js";
import { runMigrations } from "../../db/migrate.js";
import { eq } from "drizzle-orm";

let migrated = false;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (e) {
      console.warn("[whatconverts-webhook] migration warning:", e);
    }
  }

  // Webhook verification / Secret token verification
  const webhookSecret = process.env.WHATCONVERTS_WEBHOOK_SECRET;
  const authHeader = req.headers.get("x-whatconverts-secret") || req.headers.get("authorization");
  
  if (webhookSecret && authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token !== webhookSecret) {
      console.warn("[whatconverts-webhook] Unauthorized webhook attempt");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const raw = await req.text();
    if (!raw) return new Response("Empty body", { status: 400 });

    const data = JSON.parse(raw);
    
    // Handle WhatConverts standard lead / call payload structure
    const callId = String(data.lead_id || data.call_id || data.id || `wc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    
    // 1. DEDUPLICATION: Prevent duplicate call records
    const existing = await db.select().from(calls).where(eq(calls.callId, callId)).limit(1);
    if (existing.length > 0) {
      console.log(`[whatconverts-webhook] Duplicate call ${callId} skipped.`);
      return Response.json({ message: "Call already recorded", callId });
    }

    // Extract call details
    const callerNumber = (data.caller_number || data.caller_phone || data.phone_number || "").trim();
    const trackingNumber = (data.tracking_number || data.tracking_phone_number || "").trim();
    const forwardedToNumber = (data.destination_number || data.forwarded_to || "855-557-3703").trim();
    const callDuration = parseInt(String(data.call_duration || data.duration || "0"), 10) || 0;
    const callStatus = (data.call_status || data.status || "completed").toLowerCase();
    const callTime = data.date_created ? new Date(data.date_created) : new Date();

    // Extract attribution & click IDs
    const source = (data.source || data.utm_source || "").trim();
    const medium = (data.medium || data.utm_medium || "").trim();
    const campaign = (data.campaign || data.utm_campaign || "").trim();
    const keyword = (data.keyword || data.utm_term || "").trim();
    const landingPage = (data.landing_url || data.landing_page || "").trim();
    const gclid = (data.gclid || "").trim();
    const msclkid = (data.msclkid || "").trim();
    const visitorId = (data.custom_fields?.visitor_id || data.visitor_id || "").trim();
    const sessionId = (data.custom_fields?.session_id || data.session_id || "").trim();

    // 2. INSERT CALL RECORD (recording is strictly disabled by policy)
    const [newCall] = await db.insert(calls).values({
      callId,
      visitorId: visitorId || null,
      sessionId: sessionId || null,
      callerNumber,
      trackingNumber,
      forwardedToNumber,
      callDurationSeconds: callDuration,
      callStatus,
      callTime,
      source,
      medium,
      campaign,
      keyword,
      landingPage,
      gclid,
      msclkid,
      stage: "New",
      recordingDisabled: true, // Call recording remains strictly disabled
      rawPayload: data
    }).returning();

    // 3. LOG EVENT
    if (visitorId) {
      await db.insert(events).values({
        visitorId,
        sessionId: sessionId || null,
        eventName: "phone_call_completed",
        pagePath: landingPage || "/",
        source: source || "phone",
        metadata: { call_id: newCall.id, duration: callDuration, status: callStatus }
      });
    }

    console.log(`[whatconverts-webhook] Successfully processed call ${callId}`);
    return Response.json({ success: true, callId: newCall.id });
  } catch (err) {
    console.error("[whatconverts-webhook] Error processing webhook:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};

export const config: Config = {
  path: "/api/whatconverts-webhook",
};
