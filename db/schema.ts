// db/schema.ts
import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

// One row per click on a "Donate" call-to-action button.
export const donateClicks = pgTable(
  "donate_clicks",
  {
    id: serial().primaryKey(),
    // Which button was clicked (e.g. "hero", "nav", "action-bar", "footer").
    source: text().notNull().default("unknown"),
    // Page the click happened on.
    path: text().notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("donate_clicks_created_at_idx").on(t.createdAt)],
);
