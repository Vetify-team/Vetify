import { describe, expect, it, vi } from 'vitest';
import { hashLinkToken } from '../common/link-tokens.js';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  SIGNUP_LINK_TTL_MS,
  SignupLinksService,
  signupLink,
} from './signup-links.service.js';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const ORIGIN = 'https://clinica.vetify.live';
const TOKEN = 'a'.repeat(43);

const build = (existing = 0) => {
  const send = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    user: { count: vi.fn().mockResolvedValue(existing) },
    clinicSignupLink: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'link-1',
        ...data,
        createdAt: new Date(),
      })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'link-1' }),
    },
  };
  const service = new SignupLinksService(
    prisma as unknown as PrismaService,
    { send } as unknown as MailService,
  );
  return { service, prisma, send };
};

describe('SignupLinksService.issue', () => {
  it('stores only the hash, emails the link and returns it once', async () => {
    const { service, prisma, send } = build();
    const issued = await service.issue(
      ADMIN,
      {
        email: 'Sol@Vet.cr',
        clinicName: 'Vet <Sol>',
        plan: 'clinic',
        paymentReference: 'SINPE 123',
      },
      ORIGIN,
    );

    const stored = prisma.clinicSignupLink.create.mock.calls[0]![0].data;
    expect(stored).toMatchObject({
      email: 'sol@vet.cr',
      plan: 'clinic',
      paymentReference: 'SINPE 123',
      createdById: ADMIN,
    });
    const token = issued.url.split('#clinica=')[1]!;
    expect(issued.url).toBe(signupLink(ORIGIN, token));
    expect(stored.tokenHash).toBe(hashLinkToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    const ttl = (stored.expiresAt as Date).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(SIGNUP_LINK_TTL_MS - 5_000);

    const email = send.mock.calls[0]![0];
    expect(email.to).toBe('sol@vet.cr');
    expect(email.text).toContain(issued.url);
    expect(email.html).toContain('Vet &lt;Sol&gt;');
  });

  it('refuses an email that already has an account', async () => {
    const { service, prisma, send } = build(1);
    await expect(
      service.issue(
        ADMIN,
        { email: 'owner@mail.cr', clinicName: 'X', plan: 'pilot' },
        ORIGIN,
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(prisma.clinicSignupLink.create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the link when the email fails: the admin has it to hand over', async () => {
    const { service, send } = build();
    send.mockRejectedValue(new Error('Resend down'));
    await expect(
      service.issue(
        ADMIN,
        { email: 'sol@vet.cr', clinicName: 'Sol', plan: 'pilot' },
        ORIGIN,
      ),
    ).resolves.toHaveProperty('url');
  });
});

describe('SignupLinksService.claim and preview', () => {
  it('claims only a pending link, atomically', async () => {
    const { service, prisma } = build();
    const tx = prisma as never;
    prisma.clinicSignupLink.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.claim(tx, TOKEN)).rejects.toMatchObject({
      code: 'SIGNUP_LINK_INVALID',
    });
    expect(prisma.clinicSignupLink.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashLinkToken(TOKEN),
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.clinicSignupLink.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('previews nothing for an unknown, used, revoked or expired link', async () => {
    const { service } = build();
    await expect(service.preview(TOKEN)).rejects.toMatchObject({
      code: 'SIGNUP_LINK_INVALID',
    });
  });

  it('answers 404 when revoking a link that is not pending', async () => {
    const { service, prisma } = build();
    prisma.clinicSignupLink.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.revoke('link-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
