import { afterEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import type { TokenPayload } from '@vetify/types';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { VaccinationStatusService } from '../records/vaccination-status.service.js';
import {
  isDevPushTestEnabled,
  NotificationsService,
} from './notifications.service.js';

const user = { sub: 'owner', role: 'owner' } as TokenPayload;
const endpoint = 'https://fcm.googleapis.com/fcm/send/fixture';
function setup() {
  const row = { id: 'device', endpoint, p256dh: 'key', auth: 'secret' };
  const findFirst = vi.fn(
    async ({ where }: { where: { userId: string; endpoint: string } }) =>
      where.userId === user.sub && where.endpoint === endpoint ? row : null,
  );
  const db = { pushSubscription: { findFirst, deleteMany: vi.fn() } };
  return {
    service: new NotificationsService(
      db as unknown as PrismaService,
      {} as VaccinationStatusService,
    ),
    findFirst,
  };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('development test push', () => {
  it('stays disabled by default and cannot be enabled in production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_PUSH_TEST_ENABLED', 'false');
    const { service, findFirst } = setup();
    expect(isDevPushTestEnabled()).toBe(false);
    await expect(service.sendTest(user, endpoint)).rejects.toThrow();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEV_PUSH_TEST_ENABLED', 'true');
    expect(isDevPushTestEnabled()).toBe(false);
    await expect(service.sendTest(user, endpoint)).rejects.toThrow();
    expect(findFirst).not.toHaveBeenCalled();
  });
  it('sends only to the current owner subscription when explicitly enabled', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEV_PUSH_TEST_ENABLED', 'true');
    vi.stubEnv('VAPID_PUBLIC_KEY', 'public');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'private');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:dev@example.test');
    const send = vi
      .spyOn(webpush, 'sendNotification')
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    const { service } = setup();
    await expect(
      service.sendTest({ ...user, sub: 'other' }, endpoint),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    expect(await service.sendTest(user, endpoint)).toEqual({ accepted: true });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[1]).not.toContain('owner');
  });
});
