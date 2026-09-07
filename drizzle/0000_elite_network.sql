CREATE TYPE "public"."billing" AS ENUM('oneoff', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."cost_cat" AS ENUM('hw', 'sw', 'net', 'ops', 'lab');--> statement-breakpoint
CREATE TYPE "public"."driver" AS ENUM('site', 'camera', 'pole', 'dock', 'km', 'hour', 'trip', 'pctHw', 'qty');--> statement-breakpoint
CREATE TYPE "public"."cost_group" AS ENUM('cam', 'drone', 'shared');--> statement-breakpoint
CREATE TYPE "public"."product" AS ENUM('cam', 'drone', 'both');--> statement-breakpoint
CREATE TABLE "catalog_item" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"group" "cost_group" NOT NULL,
	"cat" "cost_cat" NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"life" integer,
	"billing" "billing" NOT NULL,
	"driver" "driver" NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"prepay" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"product" "product" DEFAULT 'drone' NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"cameras" integer DEFAULT 0 NOT NULL,
	"poles" integer DEFAULT 0 NOT NULL,
	"docks" integer DEFAULT 0 NOT NULL,
	"km" double precision DEFAULT 0 NOT NULL,
	"hours" double precision DEFAULT 0 NOT NULL,
	"trips1" integer DEFAULT 0 NOT NULL,
	"trips2" integer DEFAULT 0 NOT NULL,
	"off" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"over" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"qty" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"share" boolean DEFAULT true NOT NULL,
	"prepay" boolean DEFAULT true NOT NULL,
	"renew" boolean DEFAULT true NOT NULL,
	"tax" double precision DEFAULT 21 NOT NULL,
	"horizon" integer DEFAULT 36 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;