import { badRequest, forbidden } from '../common/errors.js';
import { Injectable } from '@nestjs/common';
import {
  FREE_PLAN_LIMIT,
  type CreatePet,
  type Pet,
  type TokenPayload,
  type UpdatePet,
} from '@vetify/types';
import { BillingService } from '../billing/billing.service.js';
import { AccessLogService } from '../access-log/access-log.service.js';
import { fromIsoDate } from '../common/dates.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { idempotentWrite } from '../common/idempotency.js';
import { MAX_LIST } from '../common/limits.js';
import type { Pet as PetRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPet } from './pet.mapper.js';

/** Basic pet data. Created and edited only by its owner. */
@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly accessLog: AccessLogService,
    private readonly billing: BillingService,
  ) {}

  async list(user: TokenPayload): Promise<Pet[]> {
    const pets = await this.listVisible(user, 'list_patients');
    return pets.map(toPet);
  }

  /**
   * The owner's pets, or the clinic's patients (active full permission),
   * capped. A clinic listing reveals data of each patient, so it is logged
   * per pet under `action` (deduplicated).
   */
  async listVisible(user: TokenPayload, action: string): Promise<PetRow[]> {
    const pets = await this.prisma.pet.findMany({
      where: this.permissions.visiblePets(user),
      orderBy: { name: 'asc' },
      take: MAX_LIST,
    });
    if (user.role === 'clinic') {
      await this.accessLog.record({
        petIds: pets.map((p) => p.id),
        userId: user.sub,
        action,
        dedupe: true,
      });
    }
    return pets;
  }

  async create(
    user: TokenPayload,
    data: CreatePet,
    key?: string,
  ): Promise<Pet> {
    return idempotentWrite(this.prisma, {
      user,
      scope: 'createPet',
      key,
      payload: data,
      authorize: async () => {
        if (user.role !== 'owner') throw forbidden();
      },
      write: async (tx) => {
        // Checked inside the write so a replayed request still gets its
        // original response instead of hitting the limit it just reached.
        const { plan } = await this.billing.currentPlan(user);
        if (plan === 'free') {
          const owned = await tx.pet.count({ where: { ownerId: user.sub } });
          if (owned >= FREE_PLAN_LIMIT) {
            throw badRequest(
              `The free plan allows up to ${FREE_PLAN_LIMIT} pets`,
              'PLAN_LIMIT',
            );
          }
        }
        const pet = await tx.pet.create({
          data: {
            ownerId: user.sub,
            name: data.name,
            species: data.species,
            breed: data.breed ?? null,
            sex: data.sex ?? null,
            birthDate: data.birthDate ? fromIsoDate(data.birthDate) : null,
            neutered: data.neutered,
            microchip: data.microchip ?? null,
            photoUrl: data.photoUrl ?? null,
          },
        });
        return toPet(pet);
      },
    });
  }

  async get(user: TokenPayload, petId: string): Promise<Pet> {
    const { pet } = await this.permissions.authorize(user, petId, 'read');
    return toPet(pet);
  }

  /** Only the fields present in the request change. */
  async update(
    user: TokenPayload,
    petId: string,
    data: UpdatePet,
  ): Promise<Pet> {
    await this.permissions.authorize(user, petId, 'administer');
    const { birthDate, ...rest } = data;
    const changes = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );
    const pet = await this.prisma.pet.update({
      where: { id: petId },
      data: {
        ...changes,
        ...(birthDate ? { birthDate: fromIsoDate(birthDate) } : {}),
      },
    });
    return toPet(pet);
  }
}
