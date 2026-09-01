import { db } from "../db/index.js";
import { calls, events, sessions, visitors } from "../db/schema.js";
import { getRuntimeEnv } from "./runtime-env.js";
import { timingSafeEqualText } from "./security.js";

const MAX_WEBHOOK_BYTES = 64 * 1024;
const QUO_NUMBER = "855-557-3703";
const TRACKING_ID_PATTERN = /^(?:bfc_)?(?:vid|sid)_[a-z0-9_-]{6,92}$/i;

export interface WhatConvertsCall {
  callId: string;
  visitorId: string | null;
  sessionId: string | null;
  callerNumber: string;
  trackingNumber: string;
  forwardedToNumber: string;
  callDurationSeconds: number;
  callStatus: string;
  callTime: Date;
  source: string;
  medium: string;
  campaign: string;
  keyword: string;
  landingPage: string;
  gclid: string;
  msclkid: string;
  rawPayload: Record<string, unknown>;
}

export interface WhatConvertsRepository {
  createCall(call: WhatConvertsCall): Promise<{ created: boolean; id?: number }>;
}

export const postgresWhatConvertsRepository: WhatConvertsRepository = {
  async createCall(call) {
    return db.transaction(async (transaction) => {
      if (call.visitorId) {
        await transaction.insert(visitors).values({ id: call.visitorId }).onConflictDoNothing();
      }
      if (call.visitorId && call.sessionId) {
        await transaction.insert(sessions).values({ id: call.sessionId, visitorId: call.visitorId }).onConflictDoNothing();
      }
      const [created] = await transaction.insert(calls).values({
        ...call,
        stage: "New",
        recordingDisabled: true,
      }).onConflictDoNothing({ target: calls.callId }).returning({ id: calls.id });
      if (!created) return { created: false };
      if (call.visitorId) {
        await transaction.insert(events).values({
          visitorId: call.visitorId,
          sessionId: call.sessionId,
          eventName: "phone_call_completed",
          pagePath: call.landingPage || "/",
          source: call.source || "phone",
          metadata: { call_id: created.id, duration: call.callDurationSeconds, status: call.callStatus },
        });
      }
      return { created: true, id: created.id };
    });
  },
};

function limitedString(value: unknown, maxLength: number): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, maxLength) : "";
}

function validTrackingId(value: unknown): string | null {
  const id = limitedString(value, 100);
  return TRACKING_ID_PATTERN.test(id) ? id : null;
}

function parsePayload(data: unknown): WhatConvertsCall | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const payload = data as Record<string, any>;
  const callId = limitedString(payload.lead_id || payload.call_id || payload.id, 200);
  if (!callId) return null;
  const customFields = payload.custom_fields && typeof payload.custom_fields === "object" ? payload.custom_fields : {};
  const visitorId = validTrackingId(customFields.visitor_id || payload.visitor_id);
  const duration = Number.parseInt(limitedString(payload.call_duration ?? payload.duration ?? 0, 12), 10);
  const parsedDate = payload.date_created ? new Date(String(payload.date_created)) : new Date();
  return {
    callId,
    visitorId,
    sessionId: visitorId ? validTrackingId(customFields.session_id || payload.session_id) : null,
    callerNumber: limitedString(payload.caller_number || payload.caller_phone || payload.phone_number, 50),
    trackingNumber: limitedString(payload.tracking_number || payload.tracking_phone_number, 50),
    forwardedToNumber: QUO_NUMBER,
    callDurationSeconds: Number.isFinite(duration) && duration >= 0 ? Math.min(duration, 86400) : 0,
    callStatus: limitedString(payload.call_status || payload.status || "completed", 50).toLowerCase(),
    callTime: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    source: limitedString(payload.source || payload.utm_source, 150),
    medium: limitedString(payload.medium || payload.utm_medium, 150),
    campaign: limitedString(payload.campaign || payload.utm_campaign, 150),
    keyword: limitedString(payload.keyword || payload.utm_term, 150),
    landingPage: limitedString(payload.landing_url || payload.landing_page, 500),
    gclid: limitedString(payload.gclid, 200),
    msclkid: limitedString(payload.msclkid, 150),
    rawPayload: payload,
  };
}

export interface WhatConvertsDependencies {
  repository: WhatConvertsRepository;
  getSecret: () => string | undefined;
}

export function createWhatConvertsWebhookHandler(overrides: Partial<WhatConvertsDependencies> = {}) {
  const dependencies: WhatConvertsDependencies = {
    repository: postgresWhatConvertsRepository,
    getSecret: () => getRuntimeEnv("WHATCONVERTS_WEBHOOK_SECRET"),
    ...overrides,
  };
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
    const secret = dependencies.getSecret();
    if (!secret) return Response.json({ error: "Webhook unavailable" }, { status: 503 });
    const suppliedSecret = request.headers.get("x-whatconverts-secret");
    if (!suppliedSecret || !timingSafeEqualText(suppliedSecret, secret)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "JSON content type required" }, { status: 415 });
    }
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_WEBHOOK_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 });

    let raw = "";
    let data: unknown;
    try {
      raw = await request.text();
      if (Buffer.byteLength(raw, "utf8") > MAX_WEBHOOK_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 });
      data = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const call = parsePayload(data);
    if (!call) return Response.json({ error: "Invalid webhook payload" }, { status: 400 });

    try {
      const result = await dependencies.repository.createCall(call);
      return Response.json(result.created ? { success: true, callId: result.id } : { success: true, duplicate: true });
    } catch (error) {
      console.error("[whatconverts-webhook] processing failed", error);
      return Response.json({ error: "Webhook processing failed" }, { status: 500 });
    }
  };
}

export { QUO_NUMBER };
