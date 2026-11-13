import type { TokenPayload } from '@vetify/types';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../common/errors.js';
import type { Env } from '../config.js';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { VaccinationStatusService } from '../records/vaccination-status.service.js';
import { NotificationsService } from './notifications.service.js';

const OWNER = { sub: 'owner-1', role: 'owner' } as TokenPayload;
const NOTICE = '11111111-1111-4111-8111-111111111111';

describe('notification inbox', () => {
  let db: {
    appNotification: {
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let service: NotificationsService;

  beforeEach(() => {
    db = {
      appNotification: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new NotificationsService(
      db as unknown as PrismaService,
      {} as VaccinationStatusService,
      {} as MailService,
      {} as ConfigService<Env, true>,
    );
  });

  it('lists only the notices the owner has not dismissed', async () => {
    await service.list(OWNER);
    expect(db.appNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: OWNER.sub, dismissedAt: null },
      }),
    );
  });

  it('dismisses only a notice of the same owner, archiving it', async () => {
    await service.dismiss(OWNER, NOTICE);
    const [args] = db.appNotification.updateMany.mock.calls[0]!;
    expect(args.where).toEqual({
      id: NOTICE,
      userId: OWNER.sub,
      dismissedAt: null,
    });
    expect(args.data.dismissedAt).toBeInstanceOf(Date);
    expect(args.data.readAt).toBe(args.data.dismissedAt);
  });

  it('answers a notice of another owner, or one already dismissed, with 404', async () => {
    db.appNotification.updateMany.mockResolvedValue({ count: 0 });
    const error = await service.dismiss(OWNER, NOTICE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(404);
  });

  it('marks every unread notice of the owner read, and says how many', async () => {
    db.appNotification.updateMany.mockResolvedValue({ count: 3 });
    expect(await service.markAllRead(OWNER)).toEqual({ updated: 3 });
    const [args] = db.appNotification.updateMany.mock.calls[0]!;
    expect(args.where).toEqual({
      userId: OWNER.sub,
      readAt: null,
      dismissedAt: null,
    });
  });
});
