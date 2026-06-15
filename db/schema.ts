// db/schema.ts
import { pgTable, serial, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

// One row per click on a "Donate" call-to-action button.
export const donateClicks = pgTable(
  "donate_clicks",
  {
    id: serial().primaryKey(),
    // Which button was clicked (e.g. "hero", "nav", "action-bar", "footer").
    source: text().notNull().default("unknown"),
    // Page the click happened on.
    path: text().notNull().default(""),
    // Client IP address that generated the click, captured server-side from
    // Netlify's connection headers. Lets the team group clicks by visitor and
    // spot a single source generating many clicks.
    ip: text().notNull().default(""),
    // Raw browser User-Agent string, used for bot identification.
    userAgent: text("user_agent").notNull().default(""),
    // Server-side heuristic verdict: true when the User-Agent looks like a bot
    // or automated client rather than a real visitor.
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("donate_clicks_created_at_idx").on(t.createdAt),
    index("donate_clicks_ip_idx").on(t.ip),
  ],
);

// One row per website page visit, recorded server-side at the edge for every
// request to an HTML page (not just donate buttons). Lets the team see how much
// of their traffic is real visitors vs. automated clients, grouped by IP.
export const visits = pgTable(
  "visits",
  {
    id: serial().primaryKey(),
    // Page that was visited.
    path: text().notNull().default(""),
    // Client IP address, captured server-side at the edge from Netlify's
    // trusted connection signals — it cannot be set by the browser.
    ip: text().notNull().default(""),
    // Raw browser User-Agent string, used for bot identification.
    userAgent: text("user_agent").notNull().default(""),
    // Server-side heuristic verdict: true when the User-Agent looks like a bot
    // or automated client rather than a real visitor.
    isBot: boolean("is_bot").notNull().default(false),
    // Visitor's country (ISO code), from Netlify's edge geolocation. Useful for
    // spotting traffic concentrated in unexpected regions.
    country: text().notNull().default(""),
    // Referring URL, when the browser sent one.
    referrer: text().notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("visits_created_at_idx").on(t.createdAt),
    index("visits_ip_idx").on(t.ip),
  ],
);
