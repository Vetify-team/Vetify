import { z } from "zod";
import {
  dateTimeSchema,
  dateSchema,
  httpsUrlSchema,
  idSchema,
  pastDateSchema,
  textSchema,
} from "./common.js";

export const speciesSchema = z.enum(["dog", "cat", "other"]);
export type Species = z.infer<typeof speciesSchema>;

export const animalSexSchema = z.enum(["male", "female"]);
export type AnimalSex = z.infer<typeof animalSexSchema>;

export const petSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  name: z.string(),
  species: speciesSchema,
  breed: z.string().nullable(),
  sex: animalSexSchema.nullable(),
  birthDate: dateSchema.nullable(),
  neutered: z.boolean(),
  microchip: z.string().nullable(),
  photoUrl: z.string().nullable(),
  createdAt: dateTimeSchema,
});
export type Pet = z.infer<typeof petSchema>;

const petFields = {
  name: textSchema(80).min(1, { error: "Name is required" }),
  species: speciesSchema,
  breed: textSchema(80),
  sex: animalSexSchema,
  birthDate: pastDateSchema,
  neutered: z.boolean(),
  microchip: textSchema(40).regex(/^[0-9A-Za-z -]*$/, { error: "Invalid microchip" }),
  photoUrl: httpsUrlSchema,
};

export const createPetSchema = z.object({
  ...petFields,
  breed: petFields.breed.optional(),
  sex: petFields.sex.optional(),
  birthDate: petFields.birthDate.optional(),
  neutered: petFields.neutered.default(false),
  microchip: petFields.microchip.optional(),
  photoUrl: petFields.photoUrl.optional(),
});
export type CreatePet = z.infer<typeof createPetSchema>;

/**
 * Partial update. Declared explicitly, without defaults: a PATCH that omits a
 * field must leave it untouched (a `.partial()` of the create schema would
 * silently reset `neutered` to false).
 */
export const updatePetSchema = z
  .object({
    name: petFields.name,
    breed: petFields.breed,
    sex: petFields.sex,
    birthDate: petFields.birthDate,
    neutered: petFields.neutered,
    microchip: petFields.microchip,
    photoUrl: petFields.photoUrl,
  })
  .partial();
export type UpdatePet = z.infer<typeof updatePetSchema>;
