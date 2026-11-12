-- Clinic teams: roles, emailed invitations, and the author of every medical act.
CREATE TYPE "clinic_role" AS ENUM ('admin', 'veterinarian');

-- The free-text position becomes a role; the account that registered the
-- clinic was stored as 'admin', everyone else is a veterinarian.
ALTER TABLE "clinic_staff"
  ADD COLUMN "role" "clinic_role" NOT NULL DEFAULT 'veterinarian',
  ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "clinic_staff" SET "role" = 'admin' WHERE "position" = 'admin';
ALTER TABLE "clinic_staff" DROP COLUMN "position";

CREATE TABLE "clinic_invitations" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "clinic_role" NOT NULL DEFAULT 'veterinarian',
    "token_hash" TEXT NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "accepted_user_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clinic_invitations_token_hash_key" ON "clinic_invitations"("token_hash");
CREATE INDEX "clinic_invitations_clinic_id_created_at_idx" ON "clinic_invitations"("clinic_id", "created_at");
ALTER TABLE "clinic_invitations" ADD CONSTRAINT "clinic_invitations_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_invitations" ADD CONSTRAINT "clinic_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Author of each medical act (consultations already had both columns).
ALTER TABLE "vaccinations" ADD COLUMN "veterinarian_id" UUID;
ALTER TABLE "dewormings" ADD COLUMN "clinic_id" UUID, ADD COLUMN "veterinarian_id" UUID;
ALTER TABLE "treatments" ADD COLUMN "clinic_id" UUID, ADD COLUMN "veterinarian_id" UUID;
ALTER TABLE "exams" ADD COLUMN "clinic_id" UUID, ADD COLUMN "veterinarian_id" UUID;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
