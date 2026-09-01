// netlify/functions/donate-clicks.ts
import type { Config, Context } from "@netlify/functions";
import { sql, gte, eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { donateClicks } from "../../db/schema.js";
import { authorizeAdminRequest } from "../../lib/admin-auth.js";

export default async (req: Request, context: Context) => {
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.authorized) {
    return new Response(JSON.stringify({ error: authorization.error }), {
      status: authorization.status,
      headers: { "Content-Type": "application/json", "cache-control": "no-store" },
    });
  }

  const grouped = await db
    .select({
      source: donateClicks.source,
      count: sql<number>`count(*)::int`,
    })
    .from(donateClicks)
    .groupBy(donateClicks.source);

  const bySource: Record<string, number> = {};
  let total = 0;
  for (const row of grouped) {
    const n = Number(row.count);
    bySource[row.source] = n;
    total += n;
  }

  const [[botRow], [uniqueRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(donateClicks)
      .where(eq(donateClicks.isBot, true)),
    db
      .select({ count: sql<number>`count(distinct ${donateClicks.ipHash})::int` })
      .from(donateClicks)
      .where(sql`${donateClicks.ipHash} <> ''`),
  ]);
  const bots = Number(botRow?.count ?? 0);

  const since = (days: number) =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(donateClicks)
      .where(gte(donateClicks.createdAt, sql`now() - ${`${days} days`}::interval`));

  const [[d1], [d7]] = await Promise.all([since(1), since(7)]);

  return Response.json(
    {
      total,
      humans: total - bots,
      bots,
      uniqueVisitors: Number(uniqueRow?.count ?? 0),
      last24h: Number(d1?.count ?? 0),
      last7d: Number(d7?.count ?? 0),
      bySource,
    },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config: Config = {
  path: "/api/donate-clicks",
};
