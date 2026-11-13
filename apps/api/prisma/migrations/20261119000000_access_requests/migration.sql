-- A clinic asks a pet's owner for the full record after scanning its card. Additive.
CREATE TABLE "access_requests" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "requested_by_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_requests_pet_id_clinic_id_key" ON "access_requests"("pet_id", "clinic_id");

CREATE INDEX "access_requests_pet_id_status_idx" ON "access_requests"("pet_id", "status");

ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
