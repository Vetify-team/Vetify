-- Reminders by email: an owner preference and one email delivery per notice.
ALTER TABLE "users" ADD COLUMN "email_reminders" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(6),

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_deliveries_notification_id_key" ON "email_deliveries"("notification_id");
CREATE INDEX "email_deliveries_status_next_attempt_at_idx" ON "email_deliveries"("status", "next_attempt_at");

ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "app_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
