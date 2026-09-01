// netlify/functions/track-visit.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { visits } from "../../db/schema.js";
import { looksLikeBot } from "../../lib/bot.js";
import { sha256 } from "../../lib/attribution.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let path = "";
  let userAgent = "";
  let referrer = "";
  let country = "";
  try {
    const raw = await req.text();
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.path === "string") path = data.path.slice(0, 300);
      if (typeof data.userAgent === "string") userAgent = data.userAgent.slice(0, 500);
      if (typeof data.referrer === "string") referrer = data.referrer.slice(0, 500);
      if (typeof data.country === "string") country = data.country.slice(0, 8);
    }
  } catch {
    // Ignore malformed bodies
  }

  const rawIp = (
    req.headers.get("x-visitor-ip") ||
    context.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
    ""
  ).trim();

  // Hash raw IP address to protect privacy
  const ipHash = sha256(rawIp);
  const isBot = looksLikeBot(userAgent);

  try {
    await db.insert(visits).values({ path, ipHash, userAgent, isBot, country, referrer });
  } catch (err) {
    console.error("track-visit: insert failed", err);
    return new Response("error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: "/api/track-visit",
};
