import { z } from "zod";
import { clinicSchema, linkCodeValueSchema } from "./clinic.js";
import { dateTimeSchema, idSchema, pageQuerySchema, pageSchema } from "./common.js";
import { userRoleSchema } from "./user.js";

export const permissionStatusSchema = z.enum(["active", "revoked", "pending"]);
export type PermissionStatus = z.infer<typeof permissionStatusSchema>;

/**
 * `full` gives access to the record; `card_only`, only to vaccine validity.
 * The scope is enforced by the API, never by the UI.
 */
export const permissionScopeSchema = z.enum(["full", "card_only"]);
export type PermissionScope = z.infer<typeof permissionScopeSchema>;

export const permissionSchema = z.object({
  id: idSchema,
  petId: idSchema,
  clinicId: idSchema,
  scope: permissionScopeSchema,
  status: permissionStatusSchema,
  createdAt: dateTimeSchema,
});
export type Permission = z.infer<typeof permissionSchema>;

export const permissionWithClinicSchema = permissionSchema.extend({
  clinic: clinicSchema,
});
export type PermissionWithClinic = z.infer<typeof permissionWithClinicSchema>;

/**
 * Granting requires the clinic's link code: the owner can only share with a
 * clinic that is physically in front of them and was verified by an admin.
 */
export const grantPermissionSchema = z.object({
  code: linkCodeValueSchema,
  scope: permissionScopeSchema.default("full"),
});
export type GrantPermission = z.infer<typeof grantPermissionSchema>;

export const accessLogEntrySchema = z.object({
  id: idSchema,
  petId: idSchema,
  userId: idSchema.nullable(),
  action: z.string(),
  occurredAt: dateTimeSchema,
  /** Who did it, so the owner can tell their own actions from each clinic's. */
  actor: z.object({ name: z.string(), role: userRoleSchema }).nullable(),
});
export type AccessLogEntry = z.infer<typeof accessLogEntrySchema>;

export const accessLogQuerySchema = pageQuerySchema.extend({
  /** `others` hides the owner's own actions: what matters is who else looked. */
  actor: z.enum(["all", "others"]).default("all"),
});
export type AccessLogQuery = z.infer<typeof accessLogQuerySchema>;

export const accessLogPageSchema = pageSchema(accessLogEntrySchema);
export type AccessLogPage = z.infer<typeof accessLogPageSchema>;
