// lib/attribution.ts
import crypto from "node:crypto";

/**
 * Helper to hash PII or IP addresses safely using SHA-256.
 */
export function sha256(val: string | null | undefined): string {
  if (!val) return "";
  return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
}

/**
 * Extract referring domain from referrer URL safely.
 */
export function getDomain(urlStr: string | null | undefined): string {
  if (!urlStr) return "";
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Parse UTM parameters and Ad Click IDs from a URL or Query Object.
 */
export function parseMarketingParams(urlStr: string) {
  try {
    const parsed = new URL(urlStr, "https://boatsforcharity.org");
    const q = parsed.searchParams;
    return {
      utmSource: (q.get("utm_source") || "").slice(0, 150),
      utmMedium: (q.get("utm_medium") || "").slice(0, 150),
      utmCampaign: (q.get("utm_campaign") || "").slice(0, 150),
      utmTerm: (q.get("utm_term") || "").slice(0, 150),
      utmContent: (q.get("utm_content") || "").slice(0, 150),
      gclid: (q.get("gclid") || "").slice(0, 200),
      gbraid: (q.get("gbraid") || "").slice(0, 150),
      wbraid: (q.get("wbraid") || "").slice(0, 150),
      msclkid: (q.get("msclkid") || "").slice(0, 150),
    };
  } catch {
    return {
      utmSource: "", utmMedium: "", utmCampaign: "", utmTerm: "", utmContent: "",
      gclid: "", gbraid: "", wbraid: "", msclkid: ""
    };
  }
}

/**
 * Determine device category from user agent.
 */
export function getDeviceCategory(userAgent: string): "mobile" | "tablet" | "desktop" {
  const ua = (userAgent || "").toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}
