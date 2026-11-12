ALTER TABLE "drivers" ADD COLUMN "address_cep" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address_street" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address_number" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address_complement" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address_district" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address_state" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "address_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_cpf_unique" ON "drivers" USING btree ("cpf") WHERE "drivers"."cpf" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_cnh_unique" ON "drivers" USING btree ("cnh") WHERE "drivers"."cnh" <> '';