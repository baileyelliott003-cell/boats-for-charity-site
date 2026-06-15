ALTER TABLE "donate_clicks" ADD COLUMN "ip" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "donate_clicks" ADD COLUMN "user_agent" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "donate_clicks" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "donate_clicks_ip_idx" ON "donate_clicks" ("ip");