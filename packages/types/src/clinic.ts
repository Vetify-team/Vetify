import { z } from "zod";
import { dateTimeSchema, idSchema } from "./common.js";

export const clinicSchema = z.object({
  id: idSchema,
  name: z.string(),
  address: z.string().nullable(),
  country: z.string().length(2),
  plan: z.string(),
  vetCount: z.number().int(),
  /** Reviewed by an admin. Only verified clinics can issue link codes. */
  verified: z.boolean(),
  createdAt: dateTimeSchema,
});
export type Clinic = z.infer<typeof clinicSchema>;

/** Alphabet without look-alikes (0/O, 1/I/L) so codes are easy to read aloud. */
export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LINK_CODE_LENGTH = 8;

/**
 * Link code: a verified clinic shows it to the owner in person, and the owner
 * types it to grant access. Single use, short-lived.
 */
export const linkCodeValueSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .length(LINK_CODE_LENGTH, { error: "Invalid link code" })
      .regex(new RegExp(`^[${LINK_CODE_ALPHABET}]+$`), { error: "Invalid link code" }),
  );

export const linkCodeSchema = z.object({
  /** Shown to the owner formatted as XXXX-XXXX. */
  code: z.string(),
  expiresAt: dateTimeSchema,
});
export type LinkCode = z.infer<typeof linkCodeSchema>;

export const linkCodeInputSchema = z.object({ code: linkCodeValueSchema });
export type LinkCodeInput = z.infer<typeof linkCodeInputSchema>;

/** What the owner sees before confirming: which clinic the code belongs to. */
export const linkCodePreviewSchema = z.object({
  clinic: clinicSchema.pick({ id: true, name: true, address: true, verified: true }),
  expiresAt: dateTimeSchema,
});
export type LinkCodePreview = z.infer<typeof linkCodePreviewSchema>;

/** Admin listing filter. */
export const adminClinicsQuerySchema = z.object({
  verified: z.enum(["true", "false"]).optional(),
});
export type AdminClinicsQuery = z.infer<typeof adminClinicsQuerySchema>;
