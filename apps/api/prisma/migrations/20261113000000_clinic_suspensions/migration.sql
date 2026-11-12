-- Emergency suspension of a clinic, reversible and audited.
ALTER TABLE "clinics" ADD COLUMN "suspended_at" TIMESTAMPTZ(6);

CREATE TABLE "clinic_suspensions" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "suspended_by_id" UUID,
    "suspended_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifted_by_id" UUID,
    "lifted_at" TIMESTAMPTZ(6),

    CONSTRAINT "clinic_suspensions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clinic_suspensions_clinic_id_suspended_at_idx" ON "clinic_suspensions"("clinic_id", "suspended_at");

ALTER TABLE "clinic_suspensions" ADD CONSTRAINT "clinic_suspensions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_suspensions" ADD CONSTRAINT "clinic_suspensions_suspended_by_id_fkey" FOREIGN KEY ("suspended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_suspensions" ADD CONSTRAINT "clinic_suspensions_lifted_by_id_fkey" FOREIGN KEY ("lifted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
