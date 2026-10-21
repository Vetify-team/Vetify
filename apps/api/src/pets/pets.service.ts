import { Injectable } from '@nestjs/common';
import type { CreatePet, Pet, TokenPayload, UpdatePet } from '@vetify/types';
import { AccessLogService } from '../access-log/access-log.service.js';
import { fromIsoDate } from '../common/dates.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPet } from './pet.mapper.js';

/** A listing is capped; an owner or clinic never needs more on one screen. */
const MAX_LIST = 200;

/** Basic pet data. Created and edited only by its owner. */
@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly accessLog: AccessLogService,
  ) {}

  /**
   * The owner's pets, or the clinic's patients (active full permission). A
   * clinic listing reveals data of each patient, so it is logged per pet.
   */
  async list(user: TokenPayload): Promise<Pet[]> {
    const pets = await this.prisma.pet.findMany({
      where: this.permissions.visiblePets(user),
      orderBy: { name: 'asc' },
      take: MAX_LIST,
    });
    if (user.role === 'clinic') {
      await this.accessLog.record({
        petIds: pets.map((p) => p.id),
        userId: user.sub,
        action: 'list_patients',
        dedupe: true,
      });
    }
    return pets.map(toPet);
  }

  async create(user: TokenPayload, data: CreatePet): Promise<Pet> {
    const pet = await this.prisma.pet.create({
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
