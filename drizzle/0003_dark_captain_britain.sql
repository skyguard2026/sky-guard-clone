ALTER TYPE "public"."driver" ADD VALUE 'cameraAll' BEFORE 'pole';--> statement-breakpoint
ALTER TYPE "public"."driver" ADD VALUE 'tlBig' BEFORE 'pole';--> statement-breakpoint
ALTER TYPE "public"."driver" ADD VALUE 'tlSmall' BEFORE 'pole';--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "cameras_tl_big" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "cameras_tl_small" integer DEFAULT 0 NOT NULL;