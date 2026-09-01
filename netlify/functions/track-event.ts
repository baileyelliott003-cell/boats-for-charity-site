// netlify/functions/track-event.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { visitors, sessions, events, donateClicks } from "../../db/schema.js";
import { looksLikeBot } from "../../lib/bot.js";
import { sha256, getDomain, parseMarketingParams, getDeviceCategory } from "../../lib/attribution.js";
import { eq, sql } from "drizzle-orm";
import { runMigrations } from "../../db/migrate.js";

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
      console.warn("[track-event] migration warning:", e);
    }
  }

  try {
    const raw = await req.text();
    if (!raw) return new Response(null, { status: 204 });

    const data = JSON.parse(raw);
    const visitorId = (data.visitor_id || "").trim().slice(0, 100);
    const sessionId = (data.session_id || "").trim().slice(0, 100);
    const eventName = (data.event_name || "page_view").trim().slice(0, 100);
    const pagePath = (data.page_path || "").trim().slice(0, 300);
    const gaClientId = (data.ga_client_id || "").trim().slice(0, 100);
    const metadata = (typeof data.metadata === "object" && data.metadata) ? data.metadata : {};
    const touch = (typeof data.touch === "object" && data.touch) ? data.touch : {};

    const userAgent = (req.headers.get("user-agent") || "").slice(0, 500);
    const isBot = looksLikeBot(userAgent);
    const deviceCategory = getDeviceCategory(userAgent);

    const rawIp = (
      context.ip ||
      req.headers.get("x-nf-client-connection-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
      ""
    ).trim();
    const ipHash = sha256(rawIp);

    if (visitorId) {
      // Upsert visitor (persist first-touch attribution and update lastSeen)
      const ftSource = (touch.utm_source || "").slice(0, 150);
      const ftMedium = (touch.utm_medium || "").slice(0, 150);
      const ftCampaign = (touch.utm_campaign || "").slice(0, 150);
      const ftTerm = (touch.utm_term || "").slice(0, 150);
      const ftContent = (touch.utm_content || "").slice(0, 150);
      const ftLanding = (touch.landing_page || pagePath || "").slice(0, 300);
      const ftReferrer = (touch.referrer || "").slice(0, 500);
      const ftRefDomain = getDomain(ftReferrer);
      const ftGclid = (touch.gclid || "").slice(0, 200);
      const ftGbraid = (touch.gbraid || "").slice(0, 150);
      const ftWbraid = (touch.wbraid || "").slice(0, 150);
      const ftMsclkid = (touch.msclkid || "").slice(0, 150);

      await db.insert(visitors).values({
        id: visitorId,
        firstTouchSource: ftSource,
        firstTouchMedium: ftMedium,
        firstTouchCampaign: ftCampaign,
        firstTouchTerm: ftTerm,
        firstTouchContent: ftContent,
        firstLandingPage: ftLanding,
        firstReferrer: ftReferrer,
        firstReferringDomain: ftRefDomain,
        firstGclid: ftGclid,
        firstGbraid: ftGbraid,
        firstWbraid: ftWbraid,
        firstMsclkid: ftMsclkid,
        gaClientId: gaClientId,
        deviceCategory,
        userAgent
      }).onConflictDoUpdate({
        target: visitors.id,
        set: {
          lastSeenAt: sql`now()`,
          updatedAt: sql`now()`,
          gaClientId: gaClientId || sql`${visitors.gaClientId}`
        }
      });

      // Upsert session
      if (sessionId) {
        await db.insert(sessions).values({
          id: sessionId,
          visitorId: visitorId,
          landingPage: ftLanding,
          referrer: ftReferrer,
          referringDomain: ftRefDomain,
          utmSource: ftSource,
          utmMedium: ftMedium,
          utmCampaign: ftCampaign,
          utmTerm: ftTerm,
          utmContent: ftContent,
          gclid: ftGclid,
          gbraid: ftGbraid,
          wbraid: ftWbraid,
          msclkid: ftMsclkid,
          deviceCategory,
          userAgent,
          isBot
        }).onConflictDoUpdate({
          target: sessions.id,
          set: {
            lastActivityAt: sql`now()`
          }
        });
      }

      // Insert granular event
      await db.insert(events).values({
        visitorId,
        sessionId: sessionId || null,
        eventName,
        pagePath,
        source: ftSource || "direct",
        metadata,
        isBot
      });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[track-event] error:", err);
    return new Response(null, { status: 204 }); // Never break client flow
  }
};

export const config: Config = {
  path: "/api/track-event",
};
