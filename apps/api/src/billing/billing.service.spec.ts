import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '@vetify/types';
import type { Env } from '../config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { BillingService } from './billing.service.js';
import { OnvoError, type OnvoClient } from './onvo.client.js';

const user = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'owner',
} as TokenPayload;

const pending = {
  id: 'p1',
  userId: user.sub,
  clinicId: null,
  plan: 'premium',
  amount: { toFixed: () => '1500.00' },
  currency: 'CRC',
  orderNumber: 'VET-1',
  status: 'pending',
  providerSessionId: 'cs_1',
  periodEnd: null,
  createdAt: new Date(),
};

function setup(getSession: OnvoClient['getSession']) {
  const findMany = vi
    .fn()
    // First the pending sessions to recheck, then the payments to list.
    .mockResolvedValueOnce([pending])
    .mockResolvedValueOnce([]);
  const prisma = {
    payment: { findMany },
    user: { findUnique: vi.fn().mockResolvedValue({ plan: 'free' }) },
  } as unknown as PrismaService;
  const getSessionMock = vi.fn(getSession);
  const onvo = {
    enabled: true,
    mode: 'test',
    getSession: getSessionMock,
    getPaymentIntent: vi.fn(),
  } as unknown as OnvoClient;
  const service = new BillingService(
    prisma,
    onvo,
    {} as ConfigService<Env, true>,
  );
  return { service, getSession: getSessionMock, findMany };
}

describe('BillingService.status without a webhook', () => {
  it('rechecks recent pending ONVO sessions before answering', async () => {
    const { service, getSession, findMany } = setup(async () => ({
      status: 'open',
      paymentStatus: 'unpaid',
      mode: 'test',
    }));
    const status = await service.status(user);
    expect(getSession).toHaveBeenCalledWith('cs_1');
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        userId: user.sub,
        status: 'pending',
        providerSessionId: { not: null },
      },
      take: 3,
    });
    expect(status.plan).toBe('free');
  });

  it('still answers when ONVO fails', async () => {
    const { service } = setup(async () => {
      throw new OnvoError('ONVO answered 500');
    });
    await expect(service.status(user)).resolves.toMatchObject({ plan: 'free' });
  });
});
