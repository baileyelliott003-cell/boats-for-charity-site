// Netlify Function: report website-visit traffic, split by real visitors vs bots.
// GET /api/visits ->
//   { total, humans, bots, botRate, uniqueIps, last24h, last7d, topIps, topPaths }
// The human/bot split and per-IP counts let the team judge how much of their
// traffic is genuine and spot a single source generating outsized hits.
import type { Config } from "@netlify/functions";
import { sql, gte, eq, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { visits } from "../../db/schema.js";

export default async () => {
  // Overall totals and the bot split, plus how many distinct IPs are behind it.
  const [[totalRow], [botRow], [uniqueRow]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(visits),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visits)
      .where(eq(visits.isBot, true)),
    db
      .select({ count: sql<number>`count(distinct ${visits.ip})::int` })
      .from(visits)
      .where(sql`${visits.ip} <> ''`),
  ]);

  const total = Number(totalRow?.count ?? 0);
  const bots = Number(botRow?.count ?? 0);
  const humans = total - bots;

  // The IPs responsible for the most visits — a single IP with an outsized
  // share is a strong bot/abuse signal.
  const topIps = await db
    .select({
      ip: visits.ip,
      count: sql<number>`count(*)::int`,
      bot: sql<boolean>`bool_or(${visits.isBot})`,
    })
    .from(visits)
    .where(sql`${visits.ip} <> ''`)
    .groupBy(visits.ip)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // The most-visited pages.
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
      // Share of all visits flagged as bots, 0–1, rounded to 3 decimals.
      botRate: total ? Math.round((bots / total) * 1000) / 1000 : 0,
      uniqueIps: Number(uniqueRow?.count ?? 0),
      last24h: Number(d1?.count ?? 0),
      last7d: Number(d7?.count ?? 0),
      topIps: topIps.map((r) => ({
        ip: r.ip,
        count: Number(r.count),
        bot: Boolean(r.bot),
      })),
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
