import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AccessLogService } from './access-log.service.js';

const build = (recentPetIds: string[]) => {
  const createMany = vi.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    accessLog: {
      findMany: vi
        .fn()
        .mockResolvedValue(recentPetIds.map((petId) => ({ petId }))),
      createMany,
    },
    pet: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) },
  };
  return {
    service: new AccessLogService(prisma as unknown as PrismaService),
    createMany,
    prisma,
  };
};

describe('AccessLogService', () => {
  it('skips reads already logged in the window, so repeated requests cannot flood the log', async () => {
    const { service, createMany } = build(['p1']);
    await service.record({
      petIds: ['p1', 'p2', 'p2'],
      userId: 'u1',
      action: 'view_alerts',
      dedupe: true,
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ petId: 'p2', userId: 'u1', action: 'view_alerts' }],
    });
  });

  it('writes nothing when every pet was logged recently', async () => {
    const { service, createMany } = build(['p1']);
    await service.record({
      petIds: ['p1'],
      userId: 'u1',
      action: 'view_record',
      dedupe: true,
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('never deduplicates writes', async () => {
    const { service, createMany, prisma } = build(['p1']);
    await service.record({
      petIds: ['p1'],
      userId: 'u1',
      action: 'record_vaccination',
    });
    expect(prisma.accessLog.findMany).not.toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledOnce();
  });

  it('logs a denied attempt only when the pet exists', async () => {
    const { service, createMany, prisma } = build([]);
    await service.recordDenied('p1', 'u1');
    expect(createMany).toHaveBeenCalledWith({
      data: [{ petId: 'p1', userId: 'u1', action: 'access_denied' }],
    });

    prisma.pet.findUnique.mockResolvedValue(null);
    createMany.mockClear();
    await service.recordDenied('missing', 'u1');
    expect(createMany).not.toHaveBeenCalled();
  });
});
