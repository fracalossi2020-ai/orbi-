ALTER TABLE "drivers" ADD COLUMN "birth_date" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "cnh_category" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "cnh_first_license_at" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "cnh_expires_at" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "cnh_ear" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "inss_declared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "doors" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "seats" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "air_conditioning" boolean;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "ownership" text;