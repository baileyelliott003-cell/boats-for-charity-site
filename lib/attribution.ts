// lib/attribution.ts
import crypto from "node:crypto";

/**
 * Normalize and SHA-256 hash an email address per Google Ads Data Manager specification.
 * - Lowercase all characters
 * - Remove all whitespace
 * - If already a 64-character hex SHA-256 string, avoid double-hashing
 */
export function hashEmail(val: string | null | undefined): string {
  if (!val) return "";
  const clean = val.trim().toLowerCase();
  if (!clean) return "";
  if (/^[a-f0-9]{64}$/i.test(clean)) {
    return clean; // Already hashed, avoid double-hashing
  }
  return crypto.createHash("sha256").update(clean).digest("hex");
}

/**
 * Normalize and SHA-256 hash a phone number per Google Ads Data Manager specification (E.164).
 * - Format in E.164 standard (e.g. +18555573703)
 * - If US number missing country code, prepend +1
 * - If already a 64-character hex SHA-256 string, avoid double-hashing
 */
export function hashPhone(val: string | null | undefined): string {
  if (!val) return "";
  const clean = val.trim();
  if (!clean) return "";
  if (/^[a-f0-9]{64}$/i.test(clean)) {
    return clean; // Already hashed, avoid double-hashing
  }
  const digits = clean.replace(/\D/g, "");
  if (!digits) return "";
  
  let e164 = "";
  if (clean.startsWith("+")) {
    e164 = "+" + digits;
  } else if (digits.length === 10) {
    e164 = "+1" + digits; // Standard 10-digit US
  } else if (digits.length === 11 && digits.startsWith("1")) {
    e164 = "+" + digits; // 11-digit US with leading 1
  } else {
    e164 = "+" + digits;
  }
  
  return crypto.createHash("sha256").update(e164).digest("hex");
}

/**
 * Generic SHA-256 helper for internal identifiers, IP hashing, etc.
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

/**
 * Authenticate staff dashboard requests using Netlify environment credentials.
 */
export function verifyDashboardAuth(authHeader: string | null | undefined): boolean {
  const secret = process.env.DASHBOARD_SECRET || process.env.ADMIN_KEY;
  if (!secret) {
    return false;
  }
  if (!authHeader) return false;
  
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token === secret) return true;
  
  try {
    if (authHeader.startsWith("Basic ")) {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
      const [, pass] = decoded.split(":");
      if (pass === secret || decoded === secret) return true;
    }
  } catch {}
  
  return false;
}

/**
 * Authenticate Google Ads Data Manager HTTPS feed requests using HTTP Basic Authentication
 * against GOOGLE_ADS_FEED_USERNAME and GOOGLE_ADS_FEED_PASSWORD.
 */
export function verifyGoogleAdsFeedAuth(authHeader: string | null | undefined): boolean {
  const expectedUser = process.env.GOOGLE_ADS_FEED_USERNAME;
  const expectedPass = process.env.GOOGLE_ADS_FEED_PASSWORD;
  
  if (!expectedUser || !expectedPass) {
    return false; // Credentials must be set via Netlify environment variables
  }
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }
  
  try {
    const b64 = authHeader.slice(6).trim();
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) return false;
    
    const user = decoded.slice(0, colonIndex);
    const pass = decoded.slice(colonIndex + 1);
    
    const userMatch = crypto.timingSafeEqual(
      Buffer.from(user, "utf-8"),
      Buffer.from(expectedUser, "utf-8")
    );
    const passMatch = crypto.timingSafeEqual(
      Buffer.from(pass, "utf-8"),
      Buffer.from(expectedPass, "utf-8")
    );
    
    return userMatch && passMatch;
  } catch {
    return false;
  }
}
