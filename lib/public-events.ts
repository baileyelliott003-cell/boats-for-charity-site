import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { events, sessions, visitors } from "../db/schema.js";
import { getDeviceCategory, getDomain } from "./attribution.js";
import { looksLikeBot } from "./bot.js";
import { consumePersistentRateLimit, type RateLimitResult } from "./rate-limit.js";
import { getRuntimeEnv } from "./runtime-env.js";
import { sha256Value } from "./security.js";

const MAX_EVENT_BYTES = 16 * 1024;
const TRACKING_ID_PATTERN = /^(?:bfc_)?(?:vid|sid)_[a-z0-9_-]{6,92}$/i;
const EVENT_NAMES = new Set(["page_view", "donation_form_view", "form_start", "form_submit_attempt", "phone_click"]);
const METADATA_FIELDS: Record<string, readonly string[]> = {
  page_view: ["title"],
  donation_form_view: ["form_name"],
  form_start: ["form_name"],
  form_submit_attempt: ["form_name"],
  phone_click: ["href", "text"],
};

function limitedText(value: unknown, maxLength: number): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, maxLength) : "";
}

function validId(value: unknown): string {
  const id = limitedText(value, 100);
  return TRACKING_ID_PATTERN.test(id) ? id : "";
}

export interface PublicEvent {
  visitorId: string;
  sessionId: string;
  eventName: string;
  pagePath: string;
  source: string;
  gaClientId: string;
  metadata: Record<string, string>;
  touch: {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm: string;
    utmContent: string;
    landingPage: string;
    referrer: string;
    referringDomain: string;
    gclid: string;
    gbraid: string;
    wbraid: string;
    msclkid: string;
  };
}

export function parsePublicEvent(raw: string): PublicEvent | null {
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const eventName = limitedText(data.event_name, 50);
  const visitorId = validId(data.visitor_id);
  const sessionId = validId(data.session_id);
  if (!EVENT_NAMES.has(eventName) || !visitorId || !sessionId) return null;
  const rawMetadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};
  const metadata: Record<string, string> = {};
  for (const key of METADATA_FIELDS[eventName] || []) {
    const value = limitedText(rawMetadata[key], 200);
    if (value) metadata[key] = value;
  }
  const rawTouch = data.touch && typeof data.touch === "object" && !Array.isArray(data.touch) ? data.touch : {};
  const referrer = limitedText(rawTouch.referrer, 500);
  return {
    visitorId,
    sessionId,
    eventName,
    pagePath: limitedText(data.page_path, 500),
    source: limitedText(data.source, 150),
    gaClientId: limitedText(data.ga_client_id, 100),
    metadata,
    touch: {
      utmSource: limitedText(rawTouch.utm_source, 150),
      utmMedium: limitedText(rawTouch.utm_medium, 150),
      utmCampaign: limitedText(rawTouch.utm_campaign, 150),
      utmTerm: limitedText(rawTouch.utm_term, 150),
      utmContent: limitedText(rawTouch.utm_content, 150),
      landingPage: limitedText(rawTouch.landing_page, 500),
      referrer,
      referringDomain: getDomain(referrer),
      gclid: limitedText(rawTouch.gclid, 200),
      gbraid: limitedText(rawTouch.gbraid, 150),
      wbraid: limitedText(rawTouch.wbraid, 150),
      msclkid: limitedText(rawTouch.msclkid, 150),
    },
  };
}

export interface PublicEventDependencies {
  consumeRateLimit: (identifierHash: string) => Promise<RateLimitResult>;
  recordEvent: (event: PublicEvent, request: Request) => Promise<void>;
  getSalt: () => string | undefined;
}

export const recordPublicEvent = async (event: PublicEvent, request: Request): Promise<void> => {
  const userAgent = limitedText(request.headers.get("user-agent"), 500);
  const isBot = looksLikeBot(userAgent);
  const deviceCategory = getDeviceCategory(userAgent);
  await db.transaction(async (transaction) => {
    await transaction.insert(visitors).values({
      id: event.visitorId,
      firstTouchSource: event.touch.utmSource,
      firstTouchMedium: event.touch.utmMedium,
      firstTouchCampaign: event.touch.utmCampaign,
      firstTouchTerm: event.touch.utmTerm,
      firstTouchContent: event.touch.utmContent,
      firstLandingPage: event.touch.landingPage || event.pagePath,
      firstReferrer: event.touch.referrer,
      firstReferringDomain: event.touch.referringDomain,
      firstGclid: event.touch.gclid,
      firstGbraid: event.touch.gbraid,
      firstWbraid: event.touch.wbraid,
      firstMsclkid: event.touch.msclkid,
      gaClientId: event.gaClientId,
      deviceCategory,
      userAgent,
    }).onConflictDoUpdate({ target: visitors.id, set: { lastSeenAt: sql`now()`, updatedAt: sql`now()` } });
    await transaction.insert(sessions).values({
      id: event.sessionId,
      visitorId: event.visitorId,
      landingPage: event.touch.landingPage || event.pagePath,
      referrer: event.touch.referrer,
      referringDomain: event.touch.referringDomain,
      utmSource: event.touch.utmSource,
      utmMedium: event.touch.utmMedium,
      utmCampaign: event.touch.utmCampaign,
      utmTerm: event.touch.utmTerm,
      utmContent: event.touch.utmContent,
      gclid: event.touch.gclid,
      gbraid: event.touch.gbraid,
      wbraid: event.touch.wbraid,
      msclkid: event.touch.msclkid,
      deviceCategory,
      userAgent,
      isBot,
    }).onConflictDoUpdate({ target: sessions.id, set: { lastActivityAt: sql`now()` } });
    await transaction.insert(events).values({
      visitorId: event.visitorId,
      sessionId: event.sessionId,
      eventName: event.eventName,
      pagePath: event.pagePath,
      source: event.source || "direct",
      metadata: event.metadata,
      isBot,
    });
  });
};

export function createPublicEventHandler(overrides: Partial<PublicEventDependencies> = {}) {
  const dependencies: PublicEventDependencies = {
    consumeRateLimit: (identifierHash) => consumePersistentRateLimit("public-event", identifierHash, 120, 5 * 60, 10 * 60),
    recordEvent: recordPublicEvent,
    getSalt: () => getRuntimeEnv("EVENT_RATE_LIMIT_SALT") || getRuntimeEnv("DASHBOARD_SECRET"),
    ...overrides,
  };
  return async (request: Request, context: { ip?: string } = {}): Promise<Response> => {
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_EVENT_BYTES) return new Response(null, { status: 413 });
    let raw = "";
    let event: PublicEvent | null = null;
    try {
      raw = await request.text();
      if (Buffer.byteLength(raw, "utf8") > MAX_EVENT_BYTES) return new Response(null, { status: 413 });
      event = parsePublicEvent(raw);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (!event) return new Response(null, { status: 400 });
    const salt = dependencies.getSalt();
    if (!salt) return new Response(null, { status: 503 });
    const rawIp = (context.ip || request.headers.get("x-nf-client-connection-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim();
    const rateLimit = await dependencies.consumeRateLimit(sha256Value(`${salt}:${rawIp}`));
    if (!rateLimit.allowed) return new Response(null, { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } });
    try {
      await dependencies.recordEvent(event, request);
    } catch (error) {
      console.error("[track-event] persistence failed", error);
    }
    return new Response(null, { status: 204 });
  };
}

export { EVENT_NAMES };
