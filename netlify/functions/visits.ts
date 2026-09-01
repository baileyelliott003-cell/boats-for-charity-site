// netlify/functions/visits.ts
import type { Config, Context } from "@netlify/functions";
import { sql, gte, eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { visits } from "../../db/schema.js";
import { authorizeAdminRequest } from "../../lib/admin-auth.js";

export default async (req: Request, context: Context) => {
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.authorized) {
    return new Response(JSON.stringify({ error: authorization.error }), {
      status: authorization.status,
      headers: { "Content-Type": "application/json", "cache-control": "no-store" },
    });
  }

  // Overall totals and the bot split
  const [[totalRow], [botRow], [uniqueRow]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(visits),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visits)
      .where(eq(visits.isBot, true)),
    db
      .select({ count: sql<number>`count(distinct ${visits.ipHash})::int` })
      .from(visits)
      .where(sql`${visits.ipHash} <> ''`),
  ]);

  const total = Number(totalRow?.count ?? 0);
  const bots = Number(botRow?.count ?? 0);
  const humans = total - bots;

  // The most-visited pages
  const topPaths = await db
    .select({
      path: visits.path,
      count: sql<number>`count(*)::int`,
    })
    .from(visits)
    .groupBy(visits.path)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const since = (days: number) =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visits)
      .where(gte(visits.createdAt, sql`now() - ${`${days} days`}::interval`));

  const [[d1], [d7]] = await Promise.all([since(1), since(7)]);

  return Response.json(
    {
      total,
      humans,
      bots,
      botRate: total ? Math.round((bots / total) * 1000) / 1000 : 0,
      uniqueVisitors: Number(uniqueRow?.count ?? 0),
      last24h: Number(d1?.count ?? 0),
      last7d: Number(d7?.count ?? 0),
      topPaths: topPaths.map((r) => ({
        path: r.path,
        count: Number(r.count),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config: Config = {
  path: "/api/visits",
};
