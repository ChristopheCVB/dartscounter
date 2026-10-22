ALTER TABLE "actions" DROP CONSTRAINT "actions_room_id_rooms_id_fk";
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_room_id_rooms_id_fk";
--> statement-breakpoint
DROP INDEX "members_user_idx";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "room_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "joined_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() + interval '5 minutes' NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_expiry_idx" ON "members" USING btree ("expires_at");--> statement-breakpoint
-- Rooms become temporary. Keep finished results and their per-account visibility.
UPDATE "matches" SET "locked" = true, "undo" = '[]'::jsonb WHERE "summary" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "hidden_history" WHERE "match_id" IN (SELECT "id" FROM "matches" WHERE "summary" IS NULL);
--> statement-breakpoint
DELETE FROM "participants" WHERE "match_id" IN (SELECT "id" FROM "matches" WHERE "summary" IS NULL);
--> statement-breakpoint
DELETE FROM "matches" WHERE "summary" IS NULL;
--> statement-breakpoint
DELETE FROM "rooms";
--> statement-breakpoint
CREATE UNIQUE INDEX "members_user_idx" ON "members" USING btree ("user_id");
