import type { TokenPayload } from '@vetify/types';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminService } from './admin.service.js';

const CLINIC_ID = '55555555-5555-4555-8555-555555555555';
const ADMIN: TokenPayload = {
  sub: '66666666-6666-4666-8666-666666666666',
  email: 'admin@vetify.cr',
  role: 'admin',
  sid: '99999999-9999-4999-8999-999999999999',
};
const row = (suspendedAt: Date | null) => ({
  id: CLINIC_ID,
  name: 'Clínica',
  address: null,
  country: 'CR',
  plan: 'pilot',
  vetCount: 1,
  verified: true,
  suspendedAt,
  createdAt: new Date(),
});

const build = (current: Date | null, updated = 1) => {
  const tx = {
    clinic: {
      findUnique: vi.fn().mockResolvedValue({
        ...row(current),
        staff: [{ userId: 'u-a' }, { userId: 'u-b' }],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: updated }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row(new Date())),
      count: vi.fn().mockResolvedValue(1),
    },
    clinicSuspension: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    refreshSession: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const prisma = {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaService;
  return { service: new AdminService(prisma), tx };
};

describe('AdminService suspension', () => {
  it('suspends, audits who and why, and revokes every staff session under their locks', async () => {
    const { service, tx } = build(null);
    const clinic = await service.suspend(ADMIN, CLINIC_ID, {
      reason: 'Denuncia de acceso indebido',
    });

    expect(clinic.suspendedAt).not.toBeNull();
    expect(tx.clinic.updateMany).toHaveBeenCalledWith({
      where: { id: CLINIC_ID, suspendedAt: null },
      data: { suspendedAt: expect.any(Date) },
    });
    expect(tx.clinicSuspension.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: CLINIC_ID,
        reason: 'Denuncia de acceso indebido',
        suspendedById: ADMIN.sub,
      }),
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: { in: ['u-a', 'u-b'] }, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('refuses to suspend twice and writes no second audit row', async () => {
    const { service, tx } = build(new Date(), 0);
    await expect(
      service.suspend(ADMIN, CLINIC_ID, { reason: 'Otra vez' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(tx.clinicSuspension.create).not.toHaveBeenCalled();
    expect(tx.refreshSession.updateMany).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown clinic', async () => {
    const { service, tx } = build(null);
    tx.clinic.findUnique.mockResolvedValue(null);
    await expect(
      service.suspend(ADMIN, CLINIC_ID, { reason: 'Motivo' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reinstates and closes the open audit row with who lifted it', async () => {
    const { service, tx } = build(new Date());
    await service.reinstate(ADMIN, CLINIC_ID);
    expect(tx.clinic.updateMany).toHaveBeenCalledWith({
      where: { id: CLINIC_ID, suspendedAt: { not: null } },
      data: { suspendedAt: null },
    });
    expect(tx.clinicSuspension.updateMany).toHaveBeenCalledWith({
      where: { clinicId: CLINIC_ID, liftedAt: null },
      data: { liftedAt: expect.any(Date), liftedById: ADMIN.sub },
    });
  });

  it('refuses to reinstate a clinic that is not suspended', async () => {
    const { service, tx } = build(null, 0);
    await expect(service.reinstate(ADMIN, CLINIC_ID)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(tx.clinicSuspension.updateMany).not.toHaveBeenCalled();
  });
});
