CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'contacted', 'closed');--> statement-breakpoint
CREATE TABLE "inquiry" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"object_type" text DEFAULT '' NOT NULL,
	"interest" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL
);
