-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider_session_id" TEXT,
ALTER COLUMN "provider" SET DEFAULT 'onvo';

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_session_id_key" ON "payments"("provider_session_id");
