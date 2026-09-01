import crypto from "node:crypto";

export function sha256Value(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function timingSafeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, Buffer.alloc(leftBuffer.length));
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function parseCookies(request: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    cookies[name] = decodeURIComponent(part.slice(separator + 1).trim());
  }
  return cookies;
}

export function secureCookie(name: string, value: string, maxAgeSeconds: number, httpOnly: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; Secure; SameSite=Strict${httpOnly ? "; HttpOnly" : ""}`;
}

export function clearCookie(name: string, httpOnly: boolean): string {
  return secureCookie(name, "", 0, httpOnly);
}
