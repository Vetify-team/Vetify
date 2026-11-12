-- Who verified each clinic. Existing verified clinics keep a null: the app
-- did not record it before. Deleting that admin keeps the clinic verified.
ALTER TABLE "clinics" ADD COLUMN "verified_by_id" UUID;

ALTER TABLE "clinics" ADD CONSTRAINT "clinics_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
