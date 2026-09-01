import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { adminSessions } from "../db/schema.js";
import { consumePersistentRateLimit, type RateLimitResult } from "./rate-limit.js";
import { getRuntimeEnv } from "./runtime-env.js";
import {
  clearCookie,
  parseCookies,
  randomToken,
  secureCookie,
  sha256Value,
  timingSafeEqualText,
} from "./security.js";

export const ADMIN_SESSION_COOKIE = "bfc_admin_session";
export const ADMIN_CSRF_COOKIE = "bfc_admin_csrf";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

export interface AdminSessionRecord {
  tokenHash: string;
  csrfHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AdminAuthStore {
  consumeLoginRateLimit(identifierHash: string): Promise<RateLimitResult>;
  createSession(record: AdminSessionRecord & { createdAt: Date; lastUsedAt: Date }): Promise<void>;
  findSession(tokenHash: string, now: Date): Promise<AdminSessionRecord | null>;
  touchSession(tokenHash: string, now: Date): Promise<void>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
}

export const postgresAdminAuthStore: AdminAuthStore = {
  consumeLoginRateLimit(identifierHash) {
    return consumePersistentRateLimit("admin-login", identifierHash, 5, 15 * 60, 15 * 60);
  },
  async createSession(record) {
    await db.insert(adminSessions).values(record);
  },
  async findSession(tokenHash, now) {
    const [record] = await db
      .select({
        tokenHash: adminSessions.tokenHash,
        csrfHash: adminSessions.csrfHash,
        expiresAt: adminSessions.expiresAt,
        revokedAt: adminSessions.revokedAt,
      })
      .from(adminSessions)
      .where(and(
        eq(adminSessions.tokenHash, tokenHash),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, now),
      ))
      .limit(1);
    return record || null;
  },
  async touchSession(tokenHash, now) {
    await db.update(adminSessions).set({ lastUsedAt: now }).where(eq(adminSessions.tokenHash, tokenHash));
  },
  async revokeSession(tokenHash, now) {
    await db.update(adminSessions).set({ revokedAt: now }).where(eq(adminSessions.tokenHash, tokenHash));
  },
};

export interface AdminAuthDependencies {
  store: AdminAuthStore;
  getSecret: () => string | undefined;
  getRateLimitSalt: () => string | undefined;
  now: () => Date;
  randomToken: () => string;
}

const defaultDependencies: AdminAuthDependencies = {
  store: postgresAdminAuthStore,
  getSecret: () => getRuntimeEnv("DASHBOARD_SECRET"),
  getRateLimitSalt: () => getRuntimeEnv("ADMIN_RATE_LIMIT_SALT") || getRuntimeEnv("DASHBOARD_SECRET"),
  now: () => new Date(),
  randomToken: () => randomToken(32),
};

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

async function parsePassword(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    return typeof body?.password === "string" ? body.password : "";
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.formData();
    const password = body.get("password");
    return typeof password === "string" ? password : "";
  }
  return "";
}

function requestIdentifier(request: Request, context: { ip?: string }, salt: string): string {
  const rawIp = (
    context.ip ||
    request.headers.get("x-nf-client-connection-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0] ||
    "unknown"
  ).trim();
  return sha256Value(`${salt}:${rawIp}`);
}

export function createAdminLoginHandler(overrides: Partial<AdminAuthDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return async (request: Request, context: { ip?: string } = {}): Promise<Response> => {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { allow: "POST" });

    const secret = dependencies.getSecret();
    if (!secret) return jsonResponse({ error: "Dashboard authentication is unavailable" }, 503);
    const salt = dependencies.getRateLimitSalt();
    if (!salt) return jsonResponse({ error: "Dashboard authentication is unavailable" }, 503);

    const identifierHash = requestIdentifier(request, context, salt);
    const rateLimit = await dependencies.store.consumeLoginRateLimit(identifierHash);
    if (!rateLimit.allowed) {
      return jsonResponse({ error: "Too many login attempts" }, 429, { "retry-after": String(rateLimit.retryAfterSeconds) });
    }

    let password = "";
    try {
      password = await parsePassword(request);
    } catch {
      return jsonResponse({ error: "Invalid request" }, 400);
    }
    if (!password || !timingSafeEqualText(password, secret)) {
      return jsonResponse({ error: "Invalid password" }, 401);
    }

    const now = dependencies.now();
    const rawToken = dependencies.randomToken();
    const rawCsrf = dependencies.randomToken();
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_SECONDS * 1000);
    const oldToken = parseCookies(request)[ADMIN_SESSION_COOKIE];
    if (oldToken) await dependencies.store.revokeSession(sha256Value(oldToken), now);
    await dependencies.store.createSession({
      tokenHash: sha256Value(rawToken),
      csrfHash: sha256Value(rawCsrf),
      createdAt: now,
      expiresAt,
      lastUsedAt: now,
      revokedAt: null,
    });

    const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    headers.append("set-cookie", secureCookie(ADMIN_SESSION_COOKIE, rawToken, ADMIN_SESSION_SECONDS, true));
    headers.append("set-cookie", secureCookie(ADMIN_CSRF_COOKIE, rawCsrf, ADMIN_SESSION_SECONDS, false));
    return new Response(JSON.stringify({ success: true, expiresAt: expiresAt.toISOString() }), { status: 200, headers });
  };
}

export interface AdminAuthorization {
  authorized: boolean;
  status: number;
  error?: string;
  tokenHash?: string;
}

export async function authorizeAdminRequest(
  request: Request,
  options: { requireCsrf?: boolean; store?: AdminAuthStore; now?: Date } = {},
): Promise<AdminAuthorization> {
  const store = options.store || postgresAdminAuthStore;
  const now = options.now || new Date();
  const cookies = parseCookies(request);
  const rawToken = cookies[ADMIN_SESSION_COOKIE];
  if (!rawToken) return { authorized: false, status: 401, error: "Authentication required" };
  const tokenHash = sha256Value(rawToken);
  const session = await store.findSession(tokenHash, now);
  if (!session) return { authorized: false, status: 401, error: "Session expired or revoked" };

  if (options.requireCsrf) {
    const cookieToken = cookies[ADMIN_CSRF_COOKIE] || "";
    const headerToken = request.headers.get("x-csrf-token") || "";
    if (!cookieToken || !headerToken || !timingSafeEqualText(cookieToken, headerToken) || sha256Value(headerToken) !== session.csrfHash) {
      return { authorized: false, status: 403, error: "CSRF validation failed" };
    }
  }

  await store.touchSession(tokenHash, now);
  return { authorized: true, status: 200, tokenHash };
}

export function createAdminLogoutHandler(store: AdminAuthStore = postgresAdminAuthStore) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, { allow: "POST" });
    const authorization = await authorizeAdminRequest(request, { requireCsrf: true, store });
    if (!authorization.authorized) return jsonResponse({ error: authorization.error }, authorization.status);
    await store.revokeSession(authorization.tokenHash!, new Date());
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", clearCookie(ADMIN_SESSION_COOKIE, true));
    headers.append("set-cookie", clearCookie(ADMIN_CSRF_COOKIE, false));
    return new Response(null, { status: 204, headers });
  };
}
