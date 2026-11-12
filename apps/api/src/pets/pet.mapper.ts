import type { Pet } from '@vetify/types';
import { toIsoDateOrNull, toIsoDateTime } from '../common/dates.js';
import type { Pet as PetRow } from '../generated/prisma/client.js';

/** `photoUrl` comes from FilesService.photoUrl (uploaded photo or old link). */
export const toPet = (pet: PetRow, photoUrl: string | null): Pet => ({
  id: pet.id,
  ownerId: pet.ownerId,
  name: pet.name,
  species: pet.species,
  breed: pet.breed,
  sex: pet.sex,
  birthDate: toIsoDateOrNull(pet.birthDate),
  neutered: pet.neutered,
  microchip: pet.microchip,
  photoUrl,
  createdAt: toIsoDateTime(pet.createdAt),
});
