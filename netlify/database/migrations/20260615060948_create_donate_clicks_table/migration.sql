CREATE TABLE "donate_clicks" (
	"id" serial PRIMARY KEY,
	"source" text DEFAULT 'unknown' NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "donate_clicks_created_at_idx" ON "donate_clicks" ("created_at");