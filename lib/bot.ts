// Shared, server-side bot-detection heuristic.
// Used by the visit- and donate-click tracking functions so both judge
// automated traffic the same way. The check is intentionally based only on the
// User-Agent string, so it runs identically wherever the UA is available.

// Substrings that, when present in a User-Agent, strongly indicate an automated
// client (search crawlers, headless browsers, scripting libraries, monitors)
// rather than a real person browsing the site.
export const BOT_UA_PATTERNS = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "headless",
  "phantom",
  "puppeteer",
  "playwright",
  "selenium",
  "python-requests",
  "python-urllib",
  "scrapy",
  "curl",
  "wget",
  "okhttp",
  "java/",
  "go-http-client",
  "axios",
  "node-fetch",
  "httpclient",
  "facebookexternalhit",
  "preview",
  "monitor",
  "pingdom",
  "uptime",
  "lighthouse",
  "gtmetrix",
];

// Returns true when the User-Agent looks automated, or is missing entirely.
// Real browsers always send a non-empty, "mozilla"-prefixed User-Agent, so an
// empty or non-browser UA is treated as a bot.
export function looksLikeBot(userAgent: string): boolean {
  const ua = (userAgent || "").toLowerCase().trim();
  if (!ua) return true;
  if (BOT_UA_PATTERNS.some((p) => ua.includes(p))) return true;
  // Genuine browsers (and most legitimate apps) identify as "mozilla/...".
  if (!ua.includes("mozilla")) return true;
  return false;
}
