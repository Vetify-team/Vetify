import { describe, expect, it, vi } from 'vitest';
import { CardService } from './card.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PermissionsService } from '../permissions/permissions.service.js';
import type { VaccinationStatusService } from './vaccination-status.service.js';
import type { PetsService } from '../pets/pets.service.js';
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
    {} as PetsService,
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

describe('clinic vaccination cards', () => {
  const clinicUser = { sub: 'vet', role: 'clinic' } as TokenPayload;
  const pets = [
    { id: 'full-pet', name: 'Toby', species: 'dog', microchip: 'secret' },
    { id: 'card-pet', name: 'Mía', species: 'cat', microchip: 'secret' },
  ];
  const vaccines = [
    {
      vaccine: 'Rabia',
      status: 'valid',
      lastAppliedOn: '2026-11-11',
      expiresOn: '2027-11-11',
      nextDueOn: '2027-11-11',
    },
    // Scheduled, never applied: not on a card.
    {
      vaccine: 'Polivalente',
      status: 'due',
      lastAppliedOn: null,
      expiresOn: null,
      nextDueOn: null,
    },
  ];
  const build = () => {
    const listVisible = vi.fn(async () => pets);
    const fullAccess = vi.fn(async () => new Set(['full-pet']));
    const computeStatuses = vi.fn(
      async () =>
        new Map(
          pets.map((p) => [
            p.id,
            { vaccines, dewormings: [{ product: 'private' }] },
          ]),
        ),
    );
    const service = new CardService(
      {} as PrismaService,
      { fullAccess } as unknown as PermissionsService,
      { computeStatuses } as unknown as VaccinationStatusService,
      {} as ConfigService<Env, true>,
      { listVisible } as unknown as PetsService,
    );
    return { service, listVisible, fullAccess };
  };

  it('lists card-only patients too, logged, with recorded doses and nothing else', async () => {
    const { service, listVisible, fullAccess } = build();
    const cards = await service.forClinic(clinicUser);

    expect(listVisible).toHaveBeenCalledWith(clinicUser, 'view_card', {
      cards: true,
    });
    expect(fullAccess).toHaveBeenCalledWith(clinicUser, [
      'full-pet',
      'card-pet',
    ]);
    const rabies = {
      vaccine: 'Rabia',
      status: 'valid',
      lastAppliedOn: '2026-11-11',
      expiresOn: '2027-11-11',
    };
    expect(cards).toEqual([
      {
        petId: 'full-pet',
        name: 'Toby',
        species: 'dog',
        fullAccess: true,
        vaccines: [rabies],
      },
      {
        petId: 'card-pet',
        name: 'Mía',
        species: 'cat',
        fullAccess: false,
        vaccines: [rabies],
      },
    ]);
    expect(JSON.stringify(cards)).not.toContain('secret');
    expect(JSON.stringify(cards)).not.toContain('private');
  });
});
