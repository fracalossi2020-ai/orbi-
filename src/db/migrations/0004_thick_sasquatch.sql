ALTER TYPE "public"."ride_status" ADD VALUE 'scheduled' BEFORE 'searching';--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "stops" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "search_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub");