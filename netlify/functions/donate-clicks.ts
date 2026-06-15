// Netlify Function: report how many times the "Donate" buttons have been clicked.
// GET /api/donate-clicks ->
//   { total, humans, bots, uniqueIps, last24h, last7d, bySource, topIps }
// The human/bot split and per-IP counts let the team judge whether the raw
// click total reflects real visitors or automated traffic.
import type { Config } from "@netlify/functions";
import { sql, gte, eq, desc } from "drizzle-orm";
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

  // How many clicks came from real visitors vs. clients flagged as bots, and
  // how many distinct IPs are behind all of them.
  const [[botRow], [uniqueRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(donateClicks)
      .where(eq(donateClicks.isBot, true)),
    db
      .select({ count: sql<number>`count(distinct ${donateClicks.ip})::int` })
      .from(donateClicks)
      .where(sql`${donateClicks.ip} <> ''`),
  ]);
  const bots = Number(botRow?.count ?? 0);

  // The IPs responsible for the most clicks — a single IP with an outsized
  // share is a strong bot/abuse signal.
  const topIps = await db
    .select({
      ip: donateClicks.ip,
      count: sql<number>`count(*)::int`,
      bot: sql<boolean>`bool_or(${donateClicks.isBot})`,
    })
    .from(donateClicks)
    .where(sql`${donateClicks.ip} <> ''`)
    .groupBy(donateClicks.ip)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

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
      uniqueIps: Number(uniqueRow?.count ?? 0),
      last24h: Number(d1?.count ?? 0),
      last7d: Number(d7?.count ?? 0),
      bySource,
      topIps: topIps.map((r) => ({
        ip: r.ip,
        count: Number(r.count),
        bot: Boolean(r.bot),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config: Config = {
  path: "/api/donate-clicks",
};
