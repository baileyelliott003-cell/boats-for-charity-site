import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: Record<string, unknown>[] }).rows?.[0];
  }
  return undefined;
}

export async function consumePersistentRateLimit(
  scope: string,
  identifierHash: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
): Promise<RateLimitResult> {
  const result = await db.execute(sql`
    INSERT INTO abuse_rate_limits (
      scope, identifier_hash, window_started_at, request_count, blocked_until, updated_at
    ) VALUES (
      ${scope}, ${identifierHash}, now(), 1, NULL, now()
    )
    ON CONFLICT (scope, identifier_hash) DO UPDATE SET
      request_count = CASE
        WHEN abuse_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second') THEN 1
        ELSE abuse_rate_limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN abuse_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second') THEN now()
        ELSE abuse_rate_limits.window_started_at
      END,
      blocked_until = CASE
        WHEN abuse_rate_limits.blocked_until > now() THEN abuse_rate_limits.blocked_until
        WHEN abuse_rate_limits.window_started_at > now() - (${windowSeconds} * interval '1 second')
          AND abuse_rate_limits.request_count + 1 > ${limit}
          THEN now() + (${blockSeconds} * interval '1 second')
        ELSE NULL
      END,
      updated_at = now()
    RETURNING request_count, blocked_until, window_started_at
  `);
  const row = firstRow(result);
  const blockedUntil = row?.blocked_until ? new Date(String(row.blocked_until)) : null;
  const allowed = !blockedUntil || blockedUntil.getTime() <= Date.now();
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((blockedUntil!.getTime() - Date.now()) / 1000)),
  };
}
