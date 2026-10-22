import type { ConfigService } from '@nestjs/config';
import { LINK_CODE_ALPHABET } from '@vetify/types';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ClinicsService } from './clinics.service.js';
import { LinkCodesService } from './link-codes.service.js';

const config = { get: () => 'k'.repeat(32) } as unknown as ConfigService<
  never,
  true
>;

const build = (clinic: { id: string; verified: boolean }) => {
  const create = vi.fn().mockResolvedValue({});
  const service = new LinkCodesService(
    { clinicLinkCode: { create } } as unknown as PrismaService,
    { ofUser: vi.fn().mockResolvedValue(clinic) } as unknown as ClinicsService,
    config,
  );
  return { service, create };
};

describe('LinkCodesService', () => {
  it('refuses to issue codes for an unverified clinic', async () => {
    const { service, create } = build({ id: 'c1', verified: false });
    await expect(service.issue('u1')).rejects.toMatchObject({
      code: 'CLINIC_NOT_VERIFIED',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('issues a short-lived code from the readable alphabet and stores only its HMAC', async () => {
    const { service, create } = build({ id: 'c1', verified: true });
    const { code, expiresAt } = await service.issue('u1');

    expect(code).toMatch(
      new RegExp(`^[${LINK_CODE_ALPHABET}]{4}-[${LINK_CODE_ALPHABET}]{4}$`),
    );
    const ttl = Date.parse(expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000);

    const stored = create.mock.calls[0]?.[0].data;
    expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(code.replace('-', ''));
  });

  it('rejects a code that was already used or expired', async () => {
    const tx = {
      clinicLinkCode: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
    };
    const { service } = build({ id: 'c1', verified: true });
    await expect(
      service.consume(tx as never, 'ABCDEFGH', 'pet'),
    ).rejects.toMatchObject({ code: 'LINK_CODE_INVALID' });
    expect(tx.clinicLinkCode.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
