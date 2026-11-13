import type { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '@vetify/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkCodesService } from '../clinics/link-codes.service.js';
import { AppException } from '../common/errors.js';
import type { Env } from '../config.js';
import type { PetsService } from '../pets/pets.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CardService } from '../records/card.js';
import type { VaccinationStatusService } from '../records/vaccination-status.service.js';
import { PermissionsService } from './permissions.service.js';

const OWNER = { sub: 'owner', role: 'owner' } as TokenPayload;
const OTHER = { sub: 'other', role: 'owner' } as TokenPayload;
const VET = { sub: 'vet', role: 'clinic' } as TokenPayload;
const PET = '11111111-1111-4111-8111-111111111111';
const REQUEST = '22222222-2222-4222-8222-222222222222';
const clinic = {
  id: 'clinic',
  name: 'Central',
  address: null,
  country: 'CR',
  plan: 'pilot',
  vetCount: 1,
  verified: true,
  suspendedAt: null as Date | null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
};

const status = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  if (!(error instanceof AppException)) throw new Error('Expected an error');
  return {
    status: error.getStatus(),
    code: (error.getResponse() as { code: string }).code,
  };
};

describe('access requests', () => {
  let db: ReturnType<typeof makeDb>;
  let cards: CardService;
  let permissions: PermissionsService;
  let token: string;

  function makeDb() {
    let nonce: string | null = null;
    const pet = { id: PET, name: 'Rocky', ownerId: OWNER.sub };
    return {
      pet: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === PET ? pet : null,
        ),
      },
      cardLink: {
        upsert: vi.fn(({ create }: { create: { nonce: string } }) => {
          nonce = create.nonce;
        }),
        findUnique: vi.fn(({ where }: { where: { nonce?: string } }) =>
          nonce && where.nonce === nonce ? { nonce, petId: PET, pet } : null,
        ),
      },
      clinicStaff: {
        findFirst: vi.fn(async ({ where }: { where: { userId: string } }) =>
          where.userId === VET.sub ? { clinicId: clinic.id, clinic } : null,
        ),
      },
      permission: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          id: 'perm',
          petId: PET,
          clinicId: clinic.id,
          scope: 'full',
          status: 'active',
          createdAt: new Date(),
        }),
      },
      accessRequest: {
        upsert: vi.fn().mockResolvedValue({
          id: REQUEST,
          createdAt: new Date('2026-11-13T10:00:00Z'),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: REQUEST,
            clinic,
            createdAt: new Date('2026-11-13T10:00:00Z'),
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: REQUEST,
          clinicId: clinic.id,
          clinic,
        }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      appNotification: { upsert: vi.fn().mockResolvedValue({ id: 'n1' }) },
      pushSubscription: { findMany: vi.fn().mockResolvedValue([]) },
      pushDelivery: { createMany: vi.fn() },
      emailDelivery: { createMany: vi.fn() },
      $transaction: vi.fn(),
    };
  }

  beforeEach(async () => {
    db = makeDb();
    db.$transaction.mockImplementation((run: (tx: unknown) => unknown) =>
      run(db),
    );
    permissions = new PermissionsService(
      db as unknown as PrismaService,
      {} as LinkCodesService,
    );
    cards = new CardService(
      db as unknown as PrismaService,
      permissions,
      {} as VaccinationStatusService,
      {
        get: () => 'a sufficiently long test secret for cards',
      } as unknown as ConfigService<Env, true>,
      {} as PetsService,
    );
    token = (await cards.rotate(OWNER, PET)).token;
  });

  describe('a clinic asks, from the card', () => {
    it('opens one pending request for the card pet and its clinic', async () => {
      expect(await cards.requestAccess(VET, token)).toEqual({
        status: 'pending',
        petName: 'Rocky',
      });
      expect(db.accessRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { petId_clinicId: { petId: PET, clinicId: clinic.id } },
          create: { petId: PET, clinicId: clinic.id, requestedById: VET.sub },
        }),
      );
    });

    it('tells the owner, once per opening of the request', async () => {
      await cards.requestAccess(VET, token);
      expect(db.appNotification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: OWNER.sub,
            petId: PET,
            kind: 'access',
            subject: 'Central',
          }),
        }),
      );
      // Still pending: asking again keeps the date, so the same notice.
      expect(
        db.accessRequest.upsert.mock.calls[0]![0].update,
      ).not.toHaveProperty('createdAt');
    });

    it('says so when the clinic already has the full record', async () => {
      db.permission.findFirst.mockResolvedValue({ id: 'perm' });
      expect(await cards.requestAccess(VET, token)).toMatchObject({
        status: 'already',
      });
      expect(db.accessRequest.upsert).not.toHaveBeenCalled();
    });

    it('refuses a tampered card, a suspended or unverified clinic, and non-members', async () => {
      expect(
        await status(cards.requestAccess(VET, token.slice(0, -1) + 'x')),
      ).toMatchObject({
        status: 404,
      });
      db.clinicStaff.findFirst.mockResolvedValueOnce({
        clinicId: clinic.id,
        clinic: { ...clinic, suspendedAt: new Date() },
      });
      expect(await status(cards.requestAccess(VET, token))).toEqual({
        status: 403,
        code: 'CLINIC_SUSPENDED',
      });
      db.clinicStaff.findFirst.mockResolvedValueOnce({
        clinicId: clinic.id,
        clinic: { ...clinic, verified: false },
      });
      expect(await status(cards.requestAccess(VET, token))).toEqual({
        status: 403,
        code: 'CLINIC_NOT_VERIFIED',
      });
      expect(await status(cards.requestAccess(OTHER, token))).toMatchObject({
        status: 403,
      });
      expect(db.accessRequest.upsert).not.toHaveBeenCalled();
    });
  });

  describe('the owner decides', () => {
    it('lists the pending requests of their pet only', async () => {
      expect(await permissions.accessRequests(OWNER, PET)).toEqual([
        expect.objectContaining({
          id: REQUEST,
          createdAt: '2026-11-13T10:00:00.000Z',
        }),
      ]);
      expect(
        await status(permissions.accessRequests(OTHER, PET)),
      ).toMatchObject({
        status: 404,
      });
    });

    it('approving gives the clinic a full permission and closes the request', async () => {
      const granted = await permissions.approveAccessRequest(
        OWNER,
        PET,
        REQUEST,
      );
      expect(granted).toMatchObject({ scope: 'full', status: 'active' });
      expect(db.permission.upsert).toHaveBeenCalledWith({
        where: { petId_clinicId: { petId: PET, clinicId: clinic.id } },
        create: { petId: PET, clinicId: clinic.id, scope: 'full' },
        update: { scope: 'full', status: 'active' },
      });
      expect(db.accessRequest.update).toHaveBeenCalledWith({
        where: { id: REQUEST },
        data: expect.objectContaining({ status: 'approved' }),
      });
    });

    it('never approves for another owner, a missing request or a suspended clinic', async () => {
      expect(
        await status(permissions.approveAccessRequest(OTHER, PET, REQUEST)),
      ).toMatchObject({ status: 404 });
      db.accessRequest.findFirst.mockResolvedValueOnce(null);
      expect(
        await status(permissions.approveAccessRequest(OWNER, PET, REQUEST)),
      ).toMatchObject({ status: 404 });
      db.accessRequest.findFirst.mockResolvedValueOnce({
        id: REQUEST,
        clinicId: clinic.id,
        clinic: { ...clinic, suspendedAt: new Date() },
      });
      expect(
        await status(permissions.approveAccessRequest(OWNER, PET, REQUEST)),
      ).toMatchObject({ status: 403, code: 'CLINIC_SUSPENDED' });
      expect(db.permission.upsert).not.toHaveBeenCalled();
    });

    it('rejecting closes the request; a missing one answers 404', async () => {
      await permissions.rejectAccessRequest(OWNER, PET, REQUEST);
      expect(db.accessRequest.updateMany).toHaveBeenCalledWith({
        where: { id: REQUEST, petId: PET, status: 'pending' },
        data: expect.objectContaining({ status: 'rejected' }),
      });
      db.accessRequest.updateMany.mockResolvedValueOnce({ count: 0 });
      expect(
        await status(permissions.rejectAccessRequest(OWNER, PET, REQUEST)),
      ).toMatchObject({ status: 404 });
    });
  });
});
