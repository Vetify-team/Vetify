-- AlterEnum
ALTER TYPE "user_role" ADD VALUE 'admin';

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "clinic_link_codes" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "used_for_pet_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_link_codes_code_hash_key" ON "clinic_link_codes"("code_hash");

-- CreateIndex
CREATE INDEX "clinic_link_codes_clinic_id_idx" ON "clinic_link_codes"("clinic_id");

-- CreateIndex
CREATE INDEX "access_logs_pet_id_user_id_action_occurred_at_idx" ON "access_logs"("pet_id", "user_id", "action", "occurred_at");

-- AddForeignKey
ALTER TABLE "clinic_link_codes" ADD CONSTRAINT "clinic_link_codes_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
