// Netlify Edge Function: record every website page visit, server-side.
//
// This runs at the network edge for every request to an HTML page, BEFORE the
// page is served. Unlike browser-side tracking, it sees the request even when
// the client never executes JavaScript — which is exactly how most bots and
// scrapers behave — so it captures the full picture of who is hitting the site.
//
// It never blocks the page: the visit is forwarded to a serverless function
// with `context.waitUntil` (fire-and-forget, after the response is sent) and the
// function returns nothing so the request proceeds to the static page normally.
import type { Config, Context } from "@netlify/edge-functions";

// Static files (scripts, styles, images, feeds, fonts, etc.) are not page
// views, so they are never recorded as visits. This is checked in code as well
// as in `config.excludedPattern` so the behaviour is guaranteed regardless of
// how the platform interprets the pattern.
const STATIC_FILE = /\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|ico|xml|txt|json|woff2?|ttf|eot|pdf|webmanifest)$/i;

export default async (req: Request, context: Context) => {
  try {
    const url = new URL(req.url);

    // Only record real page views — skip static assets.
    if (STATIC_FILE.test(url.pathname)) return;

    // The connecting client's IP, taken from Netlify's trusted edge signals —
    // it cannot be spoofed by the browser. Forwarded to the recording function
    // in a header so that function records the real visitor, not the internal
    // service-to-service hop.
    const ip = context.ip || "";

    const payload = JSON.stringify({
      path: url.pathname,
      userAgent: req.headers.get("user-agent") || "",
      referrer: req.headers.get("referer") || "",
      country: context.geo?.country?.code || "",
    });

    // Forward to the serverless recorder. Built from the incoming request's own
    // origin so it works for production and deploy previews alike. The recorder
    // path (/api/*) is excluded from this edge function, so this fetch does not
    // re-trigger it.
    context.waitUntil(
      fetch(`${url.origin}/api/track-visit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-visitor-ip": ip,
        },
        body: payload,
      }).catch(() => {
        // Tracking must never affect the visitor — swallow any error.
      }),
    );
  } catch {
    // Never let tracking interfere with serving the page.
  }

  // Return nothing: the request continues to the static page unchanged.
};

export const config: Config = {
  // Run on every page, but only for actual page views.
  path: "/*",
  // Don't track the tracking endpoint, API calls, the CMS admin, uploaded
  // assets, or the internal Netlify paths.
  excludedPath: ["/api/*", "/assets/*", "/admin/*", "/.netlify/*"],
  // Skip static files (scripts, styles, images, feeds, fonts) so only HTML page
  // requests are recorded as visits.
  excludedPattern: [
    "^.*\\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|ico|xml|txt|json|woff2?|ttf|eot|pdf)$",
  ],
  method: "GET",
};
