ALTER TABLE "settings" ADD COLUMN "inflation" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "residual_rate" double precision DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "transfer_delay" integer DEFAULT 6 NOT NULL;