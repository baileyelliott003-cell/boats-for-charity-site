// Netlify Function: record a click on a "Donate" call-to-action button.
// Called from the browser via navigator.sendBeacon / fetch when a donate
// button is clicked. Returns 204 and never blocks the user's navigation.
import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { donateClicks } from "../../db/schema.js";

export default async (req: Request) => {
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

  try {
    await db.insert(donateClicks).values({ source, path });
  } catch (err) {
    console.error("track-donate: insert failed", err);
    return new Response("error", { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const config: Config = {
  path: "/api/track-donate",
};
