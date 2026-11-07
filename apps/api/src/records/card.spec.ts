import { describe, expect, it, vi } from 'vitest';
import { CardService } from './card.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PermissionsService } from '../permissions/permissions.service.js';
import type { VaccinationStatusService } from './vaccination-status.service.js';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config.js';
import type { TokenPayload } from '@vetify/types';

const user = { sub: 'owner', role: 'owner' } as TokenPayload;
function setup() {
  let nonce: string | null = null;
  const pet = {
    id: 'pet',
    name: 'Luna',
    microchip: 'secret',
    ownerId: 'owner',
  };
  const db = {
    cardLink: {
      upsert: vi.fn(({ create }: { create: { nonce: string } }) => {
        nonce = create.nonce;
      }),
      findUnique: vi.fn(
        ({ where }: { where: { petId?: string; nonce?: string } }) =>
          nonce && (where.petId === 'pet' || where.nonce === nonce)
            ? { nonce, petId: 'pet', pet }
            : null,
      ),
      deleteMany: vi.fn(() => {
        nonce = null;
      }),
    },
  };
  const permissions = {
    authorize: vi.fn(async (u: TokenPayload) => {
      if (u.sub !== 'owner') throw new Error('denied');
      return { pet };
    }),
  };
  const status = {
    computeStatuses: vi.fn(
      async () =>
        new Map([
          [
            'pet',
            {
              vaccines: [
                {
                  vaccine: 'Rabia',
                  status: 'valid',
                  lastAppliedOn: '2026-01-01',
                  expiresOn: '2027-01-01',
                  extra: 'private',
                },
              ],
              dewormings: [{ product: 'private' }],
            },
          ],
        ]),
    ),
  };
  const config = { get: () => 'a sufficiently long test secret for cards' };
  return new CardService(
    db as unknown as PrismaService,
    permissions as unknown as PermissionsService,
    status as unknown as VaccinationStatusService,
    config as unknown as ConfigService<Env, true>,
  );
}
describe('public vaccination cards', () => {
  it('shares only selected fields, rejects tampering, and revokes old links on rotation or deletion', async () => {
    const service = setup();
    const first = await service.rotate(user, 'pet');
    expect((await service.current(user, 'pet')).token).toBe(first.token);
    expect(await service.verify(first.token)).toEqual({
      name: 'Luna',
      vaccines: [
        {
          vaccine: 'Rabia',
          status: 'valid',
          lastAppliedOn: '2026-01-01',
          expiresOn: '2027-01-01',
        },
      ],
    });
    await expect(
      service.verify(first.token.slice(0, -1) + '!'),
    ).rejects.toThrow();
    const second = await service.rotate(user, 'pet');
    await expect(service.verify(first.token)).rejects.toThrow();
    await service.revoke(user, 'pet');
    await expect(service.verify(second.token)).rejects.toThrow();
  });
  it('requires ownership for link management', async () => {
    const service = setup();
    const other = { ...user, sub: 'other' };
    await expect(service.current(other, 'pet')).rejects.toThrow();
    await expect(service.rotate(other, 'pet')).rejects.toThrow();
    await expect(service.revoke(other, 'pet')).rejects.toThrow();
  });
});
