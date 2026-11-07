import type { TokenPayload } from '@vetify/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../common/errors.js';
import type { LinkCodesService } from '../clinics/link-codes.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from './permissions.service.js';

const PET_ID = '11111111-1111-4111-8111-111111111111';
const SID = '99999999-9999-4999-8999-999999999999';
const OWNER: TokenPayload = {
  sub: '22222222-2222-4222-8222-222222222222',
  email: 'ana@mail.cr',
  role: 'owner',
  sid: SID,
};
const OTHER_OWNER: TokenPayload = {
  ...OWNER,
  sub: '33333333-3333-4333-8333-333333333333',
};
const CLINIC: TokenPayload = {
  sub: '44444444-4444-4444-8444-444444444444',
  email: 'vet@clinic.cr',
  role: 'clinic',
  sid: SID,
};
const ADMIN: TokenPayload = { ...CLINIC, role: 'admin' };

const pet = { id: PET_ID, ownerId: OWNER.sub, species: 'dog' };

const statusOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  return error instanceof AppException ? error.getStatus() : 'resolved';
};

describe('PermissionsService.authorize', () => {
  let prisma: {
    pet: { findUnique: ReturnType<typeof vi.fn> };
    permission: { findFirst: ReturnType<typeof vi.fn> };
  };
  let service: PermissionsService;

  beforeEach(() => {
    prisma = {
      pet: { findUnique: vi.fn().mockResolvedValue(pet) },
      permission: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    service = new PermissionsService(
      prisma as unknown as PrismaService,
      {} as LinkCodesService,
    );
  });

  it('lets the owner read and record the day to day of their pet', async () => {
    await expect(
      service.authorize(OWNER, PET_ID, 'read'),
    ).resolves.toMatchObject({ clinicId: null });
    await expect(
      service.authorize(OWNER, PET_ID, 'day_to_day'),
    ).resolves.toBeDefined();
  });

  it('answers 404 to another owner, without revealing the pet exists', async () => {
    expect(await statusOf(service.authorize(OTHER_OWNER, PET_ID, 'read'))).toBe(
      404,
    );
  });

  it('does not let the owner record a medical act', async () => {
    expect(
      await statusOf(service.authorize(OWNER, PET_ID, 'medical_act')),
    ).toBe(403);
  });

  it('denies a clinic without an active permission with 403', async () => {
    expect(await statusOf(service.authorize(CLINIC, PET_ID, 'read'))).toBe(403);
    expect(
      await statusOf(service.authorize(CLINIC, PET_ID, 'medical_act')),
    ).toBe(403);
  });

  it("only accepts active, full permissions of one of the user's clinics", async () => {
    await service.authorize(CLINIC, PET_ID, 'read').catch(() => undefined);
    expect(prisma.permission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          petId: PET_ID,
          status: 'active',
          scope: 'full',
          clinic: { staff: { some: { userId: CLINIC.sub } } },
        },
      }),
    );
  });

  it('authorizes a clinic with a permission and returns on whose behalf it acts', async () => {
    prisma.permission.findFirst.mockResolvedValue({
      clinicId: 'clinic-1',
      pet,
    });
    await expect(
      service.authorize(CLINIC, PET_ID, 'medical_act'),
    ).resolves.toEqual({ pet, clinicId: 'clinic-1' });
  });

  it('never lets a clinic touch the day to day or administer, even with a permission', async () => {
    prisma.permission.findFirst.mockResolvedValue({
      clinicId: 'clinic-1',
      pet,
    });
    expect(
      await statusOf(service.authorize(CLINIC, PET_ID, 'day_to_day')),
    ).toBe(403);
    expect(
      await statusOf(service.authorize(CLINIC, PET_ID, 'administer')),
    ).toBe(403);
  });

  it('never gives an admin access to a pet', async () => {
    expect(await statusOf(service.authorize(ADMIN, PET_ID, 'read'))).toBe(403);
    expect(service.visiblePets(ADMIN)).toEqual({ id: { in: [] } });
  });
});

describe('PermissionsService.grant', () => {
  it('fails, and creates nothing, when the link code is invalid', async () => {
    const upsert = vi.fn();
    const tx = { permission: { upsert } };
    const prisma = {
      pet: { findUnique: vi.fn().mockResolvedValue(pet) },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    };
    const linkCodes = {
      consume: vi
        .fn()
        .mockRejectedValue(
          new AppException(400, 'LINK_CODE_INVALID', 'invalid'),
        ),
    };
    const service = new PermissionsService(
      prisma as unknown as PrismaService,
      linkCodes as unknown as LinkCodesService,
    );

    await expect(
      service.grant(OWNER, PET_ID, { code: 'ABCDEFGH', scope: 'full' }),
    ).rejects.toMatchObject({
      code: 'LINK_CODE_INVALID',
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
