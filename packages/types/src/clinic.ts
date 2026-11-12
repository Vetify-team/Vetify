import { z } from "zod";
import { dateTimeSchema, idSchema, textSchema } from "./common.js";
import { passwordSchema } from "./user.js";

export const clinicSchema = z.object({
  id: idSchema,
  name: z.string(),
  address: z.string().nullable(),
  country: z.string().length(2),
  plan: z.string(),
  vetCount: z.number().int(),
  /** Reviewed by an admin. Only verified clinics can issue link codes. */
  verified: z.boolean(),
  /** Set while an admin has the clinic suspended: none of its permissions count. */
  suspendedAt: dateTimeSchema.nullable(),
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

/** Emergency suspension: the reason is kept in the audit trail. */
export const suspendClinicSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type SuspendClinic = z.infer<typeof suspendClinicSchema>;

// ---------- Team ----------

/** Role inside a clinic: `admin` manages the team; both record medical acts. */
export const clinicRoleSchema = z.enum(["admin", "veterinarian"]);
export type ClinicRole = z.infer<typeof clinicRoleSchema>;

/** The caller's clinic and their role in it. */
export const myClinicSchema = clinicSchema.extend({ role: clinicRoleSchema });
export type MyClinic = z.infer<typeof myClinicSchema>;

export const clinicMemberSchema = z.object({
  userId: idSchema,
  name: z.string(),
  email: z.email(),
  role: clinicRoleSchema,
  joinedAt: dateTimeSchema,
});
export type ClinicMember = z.infer<typeof clinicMemberSchema>;

/** Days an emailed team invitation works. */
export const CLINIC_INVITATION_DAYS = 7;

/** A pending invitation, as the clinic admin sees it. The token is never returned. */
export const clinicInvitationSchema = z.object({
  id: idSchema,
  email: z.email(),
  role: clinicRoleSchema,
  expiresAt: dateTimeSchema,
  createdAt: dateTimeSchema,
});
export type ClinicInvitation = z.infer<typeof clinicInvitationSchema>;

export const createClinicInvitationSchema = z.object({
  email: z.email().max(254),
  role: clinicRoleSchema.default("veterinarian"),
});
export type CreateClinicInvitation = z.infer<typeof createClinicInvitationSchema>;

/** The single-use token from the emailed link. */
export const invitationTokenSchema = z.object({
  token: z.string().min(20).max(200),
});
export type InvitationToken = z.infer<typeof invitationTokenSchema>;

/** What the invited person sees before creating the account. */
export const clinicInvitationPreviewSchema = z.object({
  clinicName: z.string(),
  email: z.email(),
  role: clinicRoleSchema,
  expiresAt: dateTimeSchema,
});
export type ClinicInvitationPreview = z.infer<typeof clinicInvitationPreviewSchema>;

/** Accepting creates the account with the invited email; it cannot be changed. */
export const acceptClinicInvitationSchema = invitationTokenSchema.extend({
  name: textSchema(120).min(1),
  password: passwordSchema,
  phone: textSchema(30).optional(),
  acceptTerms: z.literal(true, { error: "You must accept the terms" }),
});
export type AcceptClinicInvitation = z.infer<typeof acceptClinicInvitationSchema>;

// ---------- Clinic sign-up links (admin) ----------

/** Plans a clinic can start on: the pilot or one of the paid clinic plans. */
export const clinicPlanIdSchema = z.enum(["pilot", "office", "clinic", "chain"]);
export type ClinicPlanId = z.infer<typeof clinicPlanIdSchema>;

/** Days a clinic sign-up link works. */
export const CLINIC_SIGNUP_DAYS = 7;

export const createClinicSignupLinkSchema = z.object({
  email: z.email().max(254),
  clinicName: textSchema(160).min(1),
  plan: clinicPlanIdSchema,
  /** How the clinic paid (receipt, transfer), for the record. */
  paymentReference: textSchema(120).optional(),
});
export type CreateClinicSignupLink = z.infer<typeof createClinicSignupLinkSchema>;

/** A pending link as the admin sees it. The token is never listed. */
export const clinicSignupLinkSchema = z.object({
  id: idSchema,
  email: z.email(),
  clinicName: z.string(),
  plan: clinicPlanIdSchema,
  paymentReference: z.string().nullable(),
  expiresAt: dateTimeSchema,
  createdAt: dateTimeSchema,
});
export type ClinicSignupLink = z.infer<typeof clinicSignupLinkSchema>;

/** Returned once, when the link is created, so the admin can copy it. */
export const issuedClinicSignupLinkSchema = clinicSignupLinkSchema.extend({
  url: z.url(),
});
export type IssuedClinicSignupLink = z.infer<typeof issuedClinicSignupLinkSchema>;

/** What the clinic sees in the sign-up wizard before creating the account. */
export const clinicSignupPreviewSchema = z.object({
  email: z.email(),
  clinicName: z.string(),
  plan: clinicPlanIdSchema,
  expiresAt: dateTimeSchema,
});
export type ClinicSignupPreview = z.infer<typeof clinicSignupPreviewSchema>;

/** Registers the clinic and its first administrator with the link's email. */
export const registerClinicSchema = invitationTokenSchema.extend({
  name: textSchema(120).min(1),
  password: passwordSchema,
  phone: textSchema(30).optional(),
  clinicName: textSchema(160).min(1),
  acceptTerms: z.literal(true, { error: "You must accept the terms" }),
});
export type RegisterClinic = z.infer<typeof registerClinicSchema>;
