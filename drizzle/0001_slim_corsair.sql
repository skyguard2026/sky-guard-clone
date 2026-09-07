CREATE TYPE "public"."offer_status" AS ENUM('draft', 'odeslana', 'prijata', 'odmitnuta');--> statement-breakpoint
CREATE TABLE "offer" (
	"id" text PRIMARY KEY NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "offer_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"monthly_price" double precision DEFAULT 0 NOT NULL,
	"setup_fee" double precision DEFAULT 0 NOT NULL,
	"commitment_months" integer DEFAULT 24 NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "setup_fee" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "commitment_months" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_number_version_idx" ON "offer" USING btree ("number","version");