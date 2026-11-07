import { createHash } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { TokenPayload } from '@vetify/types';
import webpush from 'web-push';
import { z } from 'zod';
import { fromIsoDate, toIsoDate, todayInCostaRica } from '../common/dates.js';
import { badRequest, notFound } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VaccinationStatusService } from '../records/vaccination-status.service.js';

export const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
      try {
        const u = new URL(value);
        return (
          u.protocol === 'https:' &&
          !u.username &&
          !u.password &&
          !u.port &&
          !u.hash &&
          (u.hostname === 'fcm.googleapis.com' ||
            u.hostname === 'updates.push.services.mozilla.com' ||
            u.hostname.endsWith('.push.apple.com'))
        );
      } catch {
        return false;
      }
    }),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  }),
});
export const isDevPushTestEnabled = () =>
  process.env.NODE_ENV === 'development' &&
  process.env.DEV_PUSH_TEST_ENABLED === 'true';

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly db: PrismaService,
    private readonly status: VaccinationStatusService,
  ) {}
  onModuleInit() {
    if (process.env.NOTIFICATIONS_WORKER_ENABLED === 'true') {
      this.timer = setInterval(() => void this.runSafely(), 60 * 60 * 1000);
      void this.runSafely();
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async runSafely() {
    if (this.running) return;
    this.running = true;
    try {
      await this.run();
    } catch {
      this.logger.error('Notification worker failed');
    } finally {
      this.running = false;
    }
  }
  async list(user: TokenPayload) {
    const rows = await this.db.appNotification.findMany({
      where: { userId: user.sub },
      include: { pet: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      petId: row.petId,
      petName: row.pet.name,
      kind: row.kind,
      subject: row.subject,
      dueOn: toIsoDate(row.dueOn),
      offsetDays: row.offsetDays,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
  async markRead(user: TokenPayload, id: string) {
    const updated = await this.db.appNotification.updateMany({
      where: { id, userId: user.sub },
      data: { readAt: new Date() },
    });
    if (!updated.count) throw notFound();
    return { ok: true };
  }
  async subscribe(user: TokenPayload, input: SubscriptionInput) {
    const existing = await this.db.pushSubscription.findUnique({
      where: { endpoint: input.endpoint },
    });
    if (existing && existing.userId !== user.sub)
      throw badRequest(
        'Subscription belongs to another account; unsubscribe this device first',
      );
    if (existing)
      await this.db.pushSubscription.update({
        where: { id: existing.id },
        data: { p256dh: input.keys.p256dh, auth: input.keys.auth },
      });
    else {
      if (
        (await this.db.pushSubscription.count({
          where: { userId: user.sub },
        })) >= 20
      )
        throw badRequest('Subscription limit reached');
      await this.db.pushSubscription.create({
        data: {
          userId: user.sub,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
      });
    }
    return { ok: true };
  }
  async subscriptionStatus(user: TokenPayload, endpoint: string) {
    const subscription = await this.db.pushSubscription.findUnique({
      where: { endpoint },
    });
    return { active: subscription?.userId === user.sub };
  }
  async unsubscribe(user: TokenPayload, endpoint: string) {
    await this.db.pushSubscription.deleteMany({
      where: { userId: user.sub, endpoint },
    });
    return { ok: true };
  }
  async sendTest(user: TokenPayload, endpoint: string) {
    if (!isDevPushTestEnabled()) throw notFound();
    const subscription = await this.db.pushSubscription.findFirst({
      where: { userId: user.sub, endpoint },
    });
    if (!subscription) throw notFound('Push subscription not found');
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject)
      throw badRequest('Push is not configured');
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: 'Vetify',
          body: 'Tenés un recordatorio en Vetify.',
        }),
        {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: 60,
          timeout: 10000,
        },
      );
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'statusCode' in error
          ? Number(error.statusCode)
          : 0;
      if (code === 404 || code === 410)
        await this.db.pushSubscription.deleteMany({
          where: { id: subscription.id, userId: user.sub },
        });
      throw badRequest(
        'Push service rejected or could not accept the test notification',
      );
    }
    return { accepted: true };
  }
  async run() {
    const today = todayInCostaRica();
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const pets = await this.db.pet.findMany({
        take: 100,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!pets.length) break;
      cursor = pets[pets.length - 1]!.id;
      const statuses = await this.status.computeStatuses(pets);
      for (const pet of pets) {
        const status = statuses.get(pet.id)!;
        const candidates = [
          ...status.vaccines
            .filter((v) => v.lastAppliedOn && v.expiresOn)
            .map((v) => ({
              kind: 'vaccination',
              subject: v.vaccine,
              dueOn: v.expiresOn!,
            })),
          ...status.dewormings
            .filter((d) => d.nextDueOn)
            .map((d) => ({
              kind: 'deworming',
              subject: d.kind ?? 'deworming',
              dueOn: d.nextDueOn!,
            })),
        ];
        for (const item of candidates) {
          const offset =
            (fromIsoDate(item.dueOn).getTime() - today.getTime()) / 86400000;
          if (offset !== 7 && offset !== 0) continue;
          const eventKey = createHash('sha256')
            .update(
              JSON.stringify([
                pet.id,
                item.kind,
                item.subject,
                item.dueOn,
                offset,
              ]),
            )
            .digest('hex');
          const notice = await this.db.appNotification.upsert({
            where: { eventKey },
            create: {
              eventKey,
              userId: pet.ownerId,
              petId: pet.id,
              kind: item.kind,
              subject: item.subject,
              dueOn: fromIsoDate(item.dueOn),
              offsetDays: offset,
            },
            update: {},
          });
          const subscriptions = await this.db.pushSubscription.findMany({
            where: { userId: pet.ownerId },
            select: { id: true },
          });
          await this.db.pushDelivery.createMany({
            data: subscriptions.map((sub) => ({
              notificationId: notice.id,
              subscriptionId: sub.id,
            })),
            skipDuplicates: true,
          });
        }
      }
      hasMore = pets.length === 100;
    }
    await this.deliver();
  }
  private async deliver() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) return;
    const now = new Date();
    const deliveries = await this.db.pushDelivery.findMany({
      where: {
        status: 'pending',
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      include: { subscription: true, notification: { include: { pet: true } } },
      take: 100,
      orderBy: { nextAttemptAt: 'asc' },
    });
    for (const delivery of deliveries) {
      const lease = new Date(Date.now() + 60000);
      const claimed = await this.db.pushDelivery.updateMany({
        where: {
          id: delivery.id,
          status: 'pending',
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        data: { leaseUntil: lease, attempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      try {
        const pet = delivery.notification.pet;
        const status = (await this.status.computeStatuses([pet])).get(pet.id)!;
        const n = delivery.notification;
        const due = toIsoDate(n.dueOn);
        const valid =
          n.kind === 'vaccination'
            ? status.vaccines.some(
                (v) => v.vaccine === n.subject && v.expiresOn === due,
              )
            : status.dewormings.some(
                (d) =>
                  (d.kind ?? 'deworming') === n.subject && d.nextDueOn === due,
              );
        if (
          !valid ||
          toIsoDate(todayInCostaRica()) !==
            toIsoDate(new Date(n.dueOn.getTime() - n.offsetDays * 86400000))
        ) {
          await this.db.pushDelivery.updateMany({
            where: { id: delivery.id, leaseUntil: lease },
            data: { status: 'cancelled', leaseUntil: null },
          });
          continue;
        }
        await webpush.sendNotification(
          {
            endpoint: delivery.subscription.endpoint,
            keys: {
              p256dh: delivery.subscription.p256dh,
              auth: delivery.subscription.auth,
            },
          },
          JSON.stringify({
            title: 'Vetify',
            body: 'Tenés un recordatorio en Vetify.',
          }),
          {
            vapidDetails: { subject, publicKey, privateKey },
            TTL: 3600,
            timeout: 10000,
          },
        );
        await this.db.pushDelivery.updateMany({
          where: { id: delivery.id, leaseUntil: lease },
          data: { status: 'accepted', leaseUntil: null },
        });
      } catch (error) {
        const code =
          typeof error === 'object' && error && 'statusCode' in error
            ? Number(error.statusCode)
            : 0;
        if (code === 404 || code === 410)
          await this.db.pushSubscription.deleteMany({
            where: { id: delivery.subscriptionId },
          });
        else
          await this.db.pushDelivery.updateMany({
            where: { id: delivery.id, leaseUntil: lease },
            data: {
              status: delivery.attempts + 1 >= 5 ? 'failed' : 'pending',
              nextAttemptAt: new Date(Date.now() + 15 * 60000),
              leaseUntil: null,
            },
          });
      }
    }
  }
}
