CREATE TABLE "visits" (
	"id" serial PRIMARY KEY,
	"path" text DEFAULT '' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"referrer" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "visits_created_at_idx" ON "visits" ("created_at");--> statement-breakpoint
CREATE INDEX "visits_ip_idx" ON "visits" ("ip");