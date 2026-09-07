CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income', 'transfer', 'ignore');--> statement-breakpoint
CREATE TYPE "public"."category_source" AS ENUM('rule', 'manual');--> statement-breakpoint
CREATE TYPE "public"."rule_field" AS ENUM('counterName', 'counterAccount', 'vs', 'message', 'note', 'txType', 'any');--> statement-breakpoint
CREATE TYPE "public"."rule_op" AS ENUM('contains', 'equals', 'startsWith');--> statement-breakpoint
CREATE TABLE "bank_import" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account" text DEFAULT '' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"dupe_count" integer DEFAULT 0 NOT NULL,
	"problem_count" integer DEFAULT 0 NOT NULL,
	"period_from" text,
	"period_to" text,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_tx" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text NOT NULL,
	"booked_at" text NOT NULL,
	"value_date" text,
	"account" text DEFAULT '' NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'CZK' NOT NULL,
	"counter_account" text DEFAULT '' NOT NULL,
	"counter_name" text DEFAULT '' NOT NULL,
	"vs" text DEFAULT '' NOT NULL,
	"ks" text DEFAULT '' NOT NULL,
	"ss" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"tx_type" text DEFAULT '' NOT NULL,
	"fee" double precision DEFAULT 0 NOT NULL,
	"external_id" text,
	"dedupe_key" text NOT NULL,
	"category_id" text,
	"category_source" "category_source",
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"field" "rule_field" DEFAULT 'counterName' NOT NULL,
	"op" "rule_op" DEFAULT 'contains' NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" DEFAULT 'expense' NOT NULL,
	"color" text DEFAULT 'var(--muted)' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_tx" ADD CONSTRAINT "bank_tx_import_id_bank_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."bank_import"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_tx" ADD CONSTRAINT "bank_tx_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_tx_account_dedupe_idx" ON "bank_tx" USING btree ("account","dedupe_key");