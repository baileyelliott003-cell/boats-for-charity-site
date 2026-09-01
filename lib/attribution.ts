// lib/attribution.ts
import crypto from "node:crypto";

/**
 * Normalize and SHA-256 hash an email for Google Ads enhanced conversions.
 */
export function hashEmail(val: string | null | undefined): string {
  if (!val) return "";
  const clean = val.trim().toLowerCase();
  if (!clean) return "";
  if (/^[a-f0-9]{64}$/i.test(clean)) return clean;
  return crypto.createHash("sha256").update(clean).digest("hex");
}

/**
 * Normalize and SHA-256 hash a phone number in E.164 form.
 */
export function hashPhone(val: string | null | undefined): string {
  if (!val) return "";
  const clean = val.trim();
  if (!clean) return "";
  if (/^[a-f0-9]{64}$/i.test(clean)) return clean.toLowerCase();

  const digits = clean.replace(/\D/g, "");
  if (!digits) return "";

  let normalized = `+${digits}`;
  if (!clean.startsWith("+") && digits.length === 10) normalized = `+1${digits}`;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Generic SHA-256 helper for internal identifiers and abuse controls.
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
