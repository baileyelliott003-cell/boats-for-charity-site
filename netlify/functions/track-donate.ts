// Netlify Function: record a click on a "Donate" call-to-action button.
// Called from the browser via navigator.sendBeacon / fetch when a donate
// button is clicked. Returns 204 and never blocks the user's navigation.
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { donateClicks } from "../../db/schema.js";
import { looksLikeBot } from "../../lib/bot.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let source = "unknown";
  let path = "";
  try {
    const raw = await req.text();
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.source === "string" && data.source.trim()) {
        source = data.source.trim().slice(0, 100);
      }
      if (typeof data.path === "string") {
        path = data.path.slice(0, 300);
      }
    }
  } catch {
    // Ignore malformed bodies — still record the click as "unknown".
  }

  // The visitor's IP is taken from Netlify's server-side signals, never from
  // anything the browser can set in the request body, so it can't be spoofed
  // by the page. `context.ip` is the connecting client; the header is a
  // fallback for older runtimes.
  const ip = (
    context.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
    ""
  )
    .trim()
    .slice(0, 64);

  const userAgent = (req.headers.get("user-agent") || "").slice(0, 500);
  const isBot = looksLikeBot(userAgent);

  try {
    await db.insert(donateClicks).values({ source, path, ip, userAgent, isBot });
  } catch (err) {
    console.error("track-donate: insert failed", err);
    return new Response("error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: "/api/track-donate",
};
