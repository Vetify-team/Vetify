-- Keyset history pages must not sort an entire pet's history on each read.
CREATE INDEX "consultations_pet_id_date_id_idx" ON "consultations"("pet_id", "date" DESC, "id" DESC);
CREATE INDEX "vaccinations_pet_id_applied_on_id_idx" ON "vaccinations"("pet_id", "applied_on" DESC, "id" DESC);
CREATE INDEX "dewormings_pet_id_applied_on_id_idx" ON "dewormings"("pet_id", "applied_on" DESC, "id" DESC);
CREATE INDEX "dewormings_pet_id_kind_applied_on_id_idx" ON "dewormings"("pet_id", "kind", "applied_on" DESC, "id" DESC);
CREATE INDEX "treatments_pet_id_starts_on_id_idx" ON "treatments"("pet_id", "starts_on" DESC, "id" DESC);
CREATE INDEX "exams_pet_id_performed_on_id_idx" ON "exams"("pet_id", "performed_on" DESC, "id" DESC);
CREATE INDEX "weight_entries_pet_id_recorded_on_id_idx" ON "weight_entries"("pet_id", "recorded_on" DESC, "id" DESC);
CREATE INDEX "feeding_entries_pet_id_recorded_on_id_idx" ON "feeding_entries"("pet_id", "recorded_on" DESC, "id" DESC);

-- Prisma cannot express this functional index in schema.prisma. Keep the
-- expression identical to the latest-dose lookup in RecordsService.
CREATE INDEX "vaccinations_pet_vaccine_key_latest_idx" ON "vaccinations" (
  "pet_id",
  lower(regexp_replace(normalize(btrim("vaccine"), NFD), U&'[\0300-\036f]', '', 'g')),
  "applied_on" DESC,
  "id" DESC
);
