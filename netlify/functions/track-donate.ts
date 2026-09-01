// netlify/functions/track-donate.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { donateClicks } from "../../db/schema.js";
import { looksLikeBot } from "../../lib/bot.js";
import { sha256 } from "../../lib/attribution.js";

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
    // Ignore malformed bodies
  }

  const rawIp = (
    context.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
    ""
  ).trim();

  // Hash raw IP address to protect privacy
  const ipHash = sha256(rawIp);
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 500);
  const isBot = looksLikeBot(userAgent);

  try {
    await db.insert(donateClicks).values({ source, path, ipHash, userAgent, isBot });
  } catch (err) {
    console.error("track-donate: insert failed", err);
    return new Response("error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: "/api/track-donate",
};
