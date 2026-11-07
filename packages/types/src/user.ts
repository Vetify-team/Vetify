import { z } from "zod";
import { dateTimeSchema, idSchema, textSchema } from "./common.js";

/**
 * System roles. `admin` cannot be chosen at sign-up: admins are created with
 * a server-side script and only verify clinics.
 */
export const userRoleSchema = z.enum(["owner", "clinic", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const signUpRoleSchema = z.enum(["owner", "clinic"]);
export type SignUpRole = z.infer<typeof signUpRoleSchema>;

export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  name: z.string(),
  role: userRoleSchema,
  phone: z.string().nullable(),
  createdAt: dateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

/** Password policy, shared by the sign-up form and the API (ASVS 2.1: ≥ 12). */
export const passwordSchema = z
  .string()
  .min(12, { error: "Password must be at least 12 characters" })
  .max(128);

export const signUpSchema = z
  .object({
    email: z.email().max(254),
    name: textSchema(120).min(1),
    password: passwordSchema,
    role: signUpRoleSchema.default("owner"),
    phone: textSchema(30).optional(),
    /** Only for `clinic`: sign-up creates the clinic (unverified) and links the user. */
    clinicName: textSchema(160).min(1).optional(),
  })
  .refine((data) => data.role !== "clinic" || !!data.clinicName, {
    error: "Clinic name is required",
    path: ["clinicName"],
  });
export type SignUp = z.infer<typeof signUpSchema>;

export const logInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export type LogIn = z.infer<typeof logInSchema>;

/**
 * Response of sign-up, log-in and refresh. The refresh token is never in the
 * body: it travels only in an HttpOnly cookie. The access token lives in
 * memory on the client.
 */
export const sessionSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: dateTimeSchema,
  user: userSchema,
});
export type Session = z.infer<typeof sessionSchema>;

/** Content of the access token. `sid` ties it to a refresh session. */
export const tokenPayloadSchema = z.object({
  sub: idSchema,
  email: z.email(),
  role: userRoleSchema,
  sid: idSchema,
});
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
