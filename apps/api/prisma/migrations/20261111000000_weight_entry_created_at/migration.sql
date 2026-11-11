-- Same-day weight entries were ordered by their random id, so a new entry
-- could show up as older than one written earlier that day. Existing rows
-- share the migration time and keep falling back to the id.
ALTER TABLE "weight_entries" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX "weight_entries_pet_id_recorded_on_id_idx";
CREATE INDEX "weight_entries_pet_id_recorded_on_created_at_id_idx" ON "weight_entries"("pet_id", "recorded_on" DESC, "created_at" DESC, "id" DESC);
