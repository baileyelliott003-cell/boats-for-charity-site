// Netlify Function: persist a single website page visit.
//
// Called only by the `track-visit` edge function, which captures every page
// request at the edge and forwards the visitor's details here. The IP arrives
// in the `x-visitor-ip` header (set server-side at the edge from Netlify's
// trusted connection signals), so it reflects the real visitor rather than the
// internal edge-to-function hop. Returns 204 and never blocks anything.
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { visits } from "../../db/schema.js";
import { looksLikeBot } from "../../lib/bot.js";

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
    // Ignore malformed bodies — still record the visit with what we have.
  }

  // IP forwarded from the edge (trusted, server-side). Fall back to this
  // function's own connection signals if the header is ever absent.
  const ip = (
    req.headers.get("x-visitor-ip") ||
    context.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
    ""
  )
    .trim()
    .slice(0, 64);

  const isBot = looksLikeBot(userAgent);

  try {
    await db.insert(visits).values({ path, ip, userAgent, isBot, country, referrer });
  } catch (err) {
    console.error("track-visit: insert failed", err);
    return new Response("error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: "/api/track-visit",
};
