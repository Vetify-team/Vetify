import { z } from "zod";
import { dateSchema, idSchema } from "./common.js";
import { speciesSchema } from "./pet.js";

/**
 * Public response of /verify/[token]. Exposes only vaccine validity: never the
 * full record nor the owner's contact data.
 */
export const verifiedCardSchema = z.object({
  pet: z.object({
    name: z.string(),
    species: speciesSchema,
    breed: z.string().nullable(),
  }),
  vaccines: z.array(
    z.object({
      vaccine: z.string(),
      appliedOn: dateSchema,
      expiresOn: dateSchema.nullable(),
      valid: z.boolean(),
    }),
  ),
  issuedOn: dateSchema,
});
export type VerifiedCard = z.infer<typeof verifiedCardSchema>;

/** Token signed by the API. Clients never build it themselves. */
export const cardTokenSchema = z.object({
  token: z.string().min(1),
  petId: idSchema,
  expiresAt: z.iso.datetime({ offset: true }),
});
export type CardToken = z.infer<typeof cardTokenSchema>;
