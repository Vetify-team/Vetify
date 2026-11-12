import type { TokenPayload } from '@vetify/types';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MailService } from '../mail/mail.service.js';
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
  return {
    service: new AdminService(prisma, {} as MailService),
    tx,
  };
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

describe('AdminService verification', () => {
  const verifiedRow = {
    ...row(null),
    verifiedAt: new Date('2026-11-12T10:00:00Z'),
    verifiedBy: { name: 'Admin Vetify' },
    staff: [
      { user: { email: 'sol@vet.cr', name: 'Dra. Sol' } },
      { user: { email: 'luna@vet.cr', name: 'Dr. Luna' } },
    ],
  };
  const build = (updated: number, found: unknown = verifiedRow) => {
    const clinic = {
      updateMany: vi.fn().mockResolvedValue({ count: updated }),
      findUnique: vi.fn().mockResolvedValue(found),
    };
    const send = vi.fn().mockResolvedValue(undefined);
    const service = new AdminService(
      { clinic } as unknown as PrismaService,
      { send } as unknown as MailService,
    );
    return { service, clinic, send };
  };

  it('records who verified and emails each clinic administrator once', async () => {
    const { service, clinic, send } = build(1);
    const result = await service.verify(
      ADMIN,
      CLINIC_ID,
      'https://clinica.vetify.live',
    );

    expect(clinic.updateMany).toHaveBeenCalledWith({
      where: { id: CLINIC_ID, verified: false },
      data: {
        verified: true,
        verifiedAt: expect.any(Date),
        verifiedById: ADMIN.sub,
      },
    });
    expect(clinic.findUnique.mock.calls[0]![0].include.staff.where).toEqual({
      role: 'admin',
    });
    expect(result).toMatchObject({
      verified: true,
      verifiedAt: '2026-11-12T10:00:00.000Z',
      verifiedBy: { name: 'Admin Vetify' },
    });
    expect(result).not.toHaveProperty('staff');
    expect(send.mock.calls.map(([email]) => email.to)).toEqual([
      'sol@vet.cr',
      'luna@vet.cr',
    ]);
    const [email] = send.mock.calls[0]!;
    expect(email.subject).toBe('Clínica ya está verificada en Vetify');
    expect(email.text).toContain('Hola Dra. Sol:');
    expect(email.text).toContain(
      'Generar un código: https://clinica.vetify.live/codigo',
    );
  });

  it('sends nothing and keeps the first verifier when already verified', async () => {
    const { service, send } = build(0);
    await expect(service.verify(ADMIN, CLINIC_ID, null)).resolves.toMatchObject(
      { verifiedBy: { name: 'Admin Vetify' } },
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown clinic', async () => {
    const { service, send } = build(0, null);
    await expect(service.verify(ADMIN, CLINIC_ID, null)).rejects.toMatchObject({
      status: 404,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('still verifies when the email fails, and drops the button without an origin', async () => {
    const { service, send } = build(1);
    send.mockRejectedValue(new Error('Resend answered 500'));
    await expect(service.verify(ADMIN, CLINIC_ID, null)).resolves.toMatchObject(
      { verified: true },
    );
    expect(send.mock.calls[0]![0].text).not.toContain('https://');
  });
});
