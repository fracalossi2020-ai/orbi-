ALTER TYPE "public"."payment_method" ADD VALUE 'pix_driver';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'card_machine';--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "heading" double precision;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "accuracy_m" double precision;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "pix_key" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "pix_key_type" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "card_machine" boolean DEFAULT false NOT NULL;