import { describe, expect, it, vi } from 'vitest';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ClinicsService } from './clinics.service.js';
import {
  hashInvitationToken,
  INVITATION_TTL_MS,
  invitationLink,
  TeamService,
} from './team.service.js';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const clinic = { id: 'c1', name: 'Clínica <Sur>', suspendedAt: null };
const ORIGIN = 'https://clinica.vetify.live';

const build = ({
  role = 'admin' as 'admin' | 'veterinarian',
  existing = 0,
  send = vi.fn().mockResolvedValue(undefined),
} = {}) => {
  const created = {
    id: 'inv1',
    email: 'vet@sur.cr',
    role: 'veterinarian',
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    createdAt: new Date(),
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    clinicStaff: {
      findUnique: vi.fn().mockResolvedValue({ id: 's2', role: 'veterinarian' }),
      count: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue({}),
    },
    refreshSession: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    clinicInvitation: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
  };
  const prisma = {
    user: {
      count: vi.fn().mockResolvedValue(existing),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ name: 'Ana' }),
    },
    clinicInvitation: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue(created),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (t: typeof tx) => unknown)(tx),
    ),
  };
  const clinics = {
    adminOf: vi.fn(async () => {
      if (role !== 'admin')
        throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
      return clinic;
    }),
  };
  const service = new TeamService(
    prisma as unknown as PrismaService,
    clinics as unknown as ClinicsService,
    { send } as unknown as MailService,
  );
  return { service, prisma, tx, send };
};

describe('TeamService.invite', () => {
  it('stores only the token hash and emails a #fragment link to the requesting site', async () => {
    const { service, prisma, send } = build();
    await service.invite(
      ADMIN,
      { email: 'Vet@Sur.cr', role: 'veterinarian' },
      ORIGIN,
    );

    const stored = prisma.clinicInvitation.create.mock.calls[0]![0].data;
    expect(stored.email).toBe('vet@sur.cr');
    expect(stored.invitedById).toBe(ADMIN);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const ttl = stored.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(INVITATION_TTL_MS - 5_000);

    const email = send.mock.calls[0]![0];
    expect(email.to).toBe('vet@sur.cr');
    const token = /\/invitacion#([\w-]+)/.exec(email.text)![1]!;
    expect(hashInvitationToken(token)).toBe(stored.tokenHash);
    expect(email.text).toContain(invitationLink(ORIGIN, token));
    expect(email.html).toContain('Clínica &lt;Sur&gt;');
    // Inviting again replaces the previous pending link.
    expect(prisma.clinicInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        clinicId: 'c1',
        email: 'vet@sur.cr',
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('refuses an email that already has an account, and sends nothing', async () => {
    const { service, prisma, send } = build({ existing: 1 });
    await expect(
      service.invite(
        ADMIN,
        { email: 'owner@mail.cr', role: 'veterinarian' },
        ORIGIN,
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(prisma.clinicInvitation.create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('withdraws the invitation when the email cannot be sent', async () => {
    const { service, prisma } = build({
      send: vi.fn().mockRejectedValue(new Error('Resend down')),
    });
    await expect(
      service.invite(
        ADMIN,
        { email: 'vet@sur.cr', role: 'veterinarian' },
        ORIGIN,
      ),
    ).rejects.toMatchObject({ code: 'MAIL_UNAVAILABLE' });
    expect(prisma.clinicInvitation.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('is only for clinic administrators', async () => {
    const { service, prisma } = build({ role: 'veterinarian' });
    await expect(
      service.invite(MEMBER, { email: 'x@sur.cr', role: 'admin' }, ORIGIN),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.clinicInvitation.create).not.toHaveBeenCalled();
  });
});

describe('TeamService.remove', () => {
  it('deletes the membership and revokes every session under the member lock', async () => {
    const { service, tx } = build();
    await service.remove(ADMIN, MEMBER);
    expect(tx.clinicStaff.delete).toHaveBeenCalledWith({ where: { id: 's2' } });
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: MEMBER, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    // Clinic row lock, then the member's user lock.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('never removes the last administrator', async () => {
    const { service, tx } = build();
    tx.clinicStaff.findUnique.mockResolvedValue({ id: 's1', role: 'admin' });
    await expect(service.remove(ADMIN, ADMIN)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(tx.clinicStaff.delete).not.toHaveBeenCalled();
  });

  it('answers 404 for someone outside the clinic', async () => {
    const { service, tx } = build();
    tx.clinicStaff.findUnique.mockResolvedValue(null);
    await expect(service.remove(ADMIN, MEMBER)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('TeamService.claim', () => {
  it('rejects an expired, revoked or already used link atomically', async () => {
    const { service, tx } = build();
    tx.clinicInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.claim(tx as never, 'a'.repeat(43)),
    ).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(tx.clinicInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashInvitationToken('a'.repeat(43)),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { acceptedAt: expect.any(Date) },
    });
    expect(tx.clinicInvitation.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('does not let anyone join a suspended clinic', async () => {
    const { service, tx } = build();
    tx.clinicInvitation.findUniqueOrThrow.mockResolvedValue({
      clinic: { suspendedAt: new Date() },
    });
    await expect(
      service.claim(tx as never, 'a'.repeat(43)),
    ).rejects.toMatchObject({ code: 'CLINIC_SUSPENDED' });
  });
});

describe('TeamService.preview', () => {
  it('answers the same error for unknown and expired links', async () => {
    const { service, prisma } = build();
    prisma.clinicInvitation.findUnique.mockResolvedValueOnce(null);
    await expect(service.preview('a'.repeat(43))).rejects.toMatchObject({
      code: 'INVITATION_INVALID',
    });
    prisma.clinicInvitation.findUnique.mockResolvedValueOnce({
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1),
      clinic,
    });
    await expect(service.preview('a'.repeat(43))).rejects.toMatchObject({
      code: 'INVITATION_INVALID',
    });
  });
});
