-- An owner can dismiss a notice from the inbox. The row stays (its event_key
-- keeps the worker from creating the same notice again); the inbox hides it.
ALTER TABLE "app_notifications" ADD COLUMN "dismissed_at" TIMESTAMPTZ(6);
