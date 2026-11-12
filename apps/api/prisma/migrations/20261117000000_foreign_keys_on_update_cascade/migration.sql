-- DropForeignKey
ALTER TABLE "app_notifications" DROP CONSTRAINT "app_notifications_pet_id_fkey";

-- DropForeignKey
ALTER TABLE "app_notifications" DROP CONSTRAINT "app_notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "card_links" DROP CONSTRAINT "card_links_pet_id_fkey";

-- DropForeignKey
ALTER TABLE "push_deliveries" DROP CONSTRAINT "push_deliveries_notification_id_fkey";

-- DropForeignKey
ALTER TABLE "push_deliveries" DROP CONSTRAINT "push_deliveries_subscription_id_fkey";

-- DropForeignKey
ALTER TABLE "push_subscriptions" DROP CONSTRAINT "push_subscriptions_user_id_fkey";

-- AddForeignKey
ALTER TABLE "card_links" ADD CONSTRAINT "card_links_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "app_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "push_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
