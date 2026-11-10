import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';

type Db = Pick<
  Prisma.TransactionClient,
  'appNotification' | 'pushDelivery' | 'pushSubscription'
>;

export interface Notice {
  userId: string;
  petId: string;
  kind: 'vaccination' | 'deworming' | 'weight';
  subject: string;
  dueOn: Date;
  offsetDays: number;
}

/**
 * Adds a notice to the owner's inbox and queues one push per device. `event`
 * identifies the occurrence, so running it again for the same event (a worker
 * rerun, an idempotent retry) adds nothing.
 */
export async function enqueueNotice(
  db: Db,
  notice: Notice,
  event: readonly unknown[],
): Promise<void> {
  const eventKey = createHash('sha256')
    .update(JSON.stringify(event))
    .digest('hex');
  const row = await db.appNotification.upsert({
    where: { eventKey },
    create: { eventKey, ...notice },
    update: {},
  });
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: notice.userId },
    select: { id: true },
  });
  await db.pushDelivery.createMany({
    data: subscriptions.map((sub) => ({
      notificationId: row.id,
      subscriptionId: sub.id,
    })),
    skipDuplicates: true,
  });
}
