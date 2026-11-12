CREATE TABLE "saved_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "rider_name" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "rider_phone" text;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_places_user" ON "saved_places" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_places_home_work" ON "saved_places" USING btree ("user_id","kind") WHERE "saved_places"."kind" in ('home', 'work');