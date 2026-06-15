// Netlify Function: report how many times the "Donate" buttons have been clicked.
// GET /api/donate-clicks -> { total, bySource, last24h, last7d }
import type { Config } from "@netlify/functions";
import { sql, gte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { donateClicks } from "../../db/schema.js";

export default async () => {
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

  const since = (days: number) =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(donateClicks)
      .where(gte(donateClicks.createdAt, sql`now() - ${`${days} days`}::interval`));

  const [[d1], [d7]] = await Promise.all([since(1), since(7)]);

  return Response.json(
    {
      total,
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
