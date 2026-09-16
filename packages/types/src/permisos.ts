import { z } from "zod";
import { fechaHoraSchema, idSchema } from "./comun";
import { clinicaSchema } from "./clinica";

export const estadoPermisoSchema = z.enum(["activo", "revocado", "pendiente"]);
export type EstadoPermiso = z.infer<typeof estadoPermisoSchema>;

/**
 * `completo` da acceso al expediente; `solo_carne` únicamente a la vigencia de
 * vacunas. El alcance se verifica en el servicio del API, nunca en la UI.
 */
export const alcancePermisoSchema = z.enum(["completo", "solo_carne"]);
export type AlcancePermiso = z.infer<typeof alcancePermisoSchema>;

export const permisoSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  clinicaId: idSchema,
  alcance: alcancePermisoSchema,
  estado: estadoPermisoSchema,
  creadoEn: fechaHoraSchema,
});
export type Permiso = z.infer<typeof permisoSchema>;

/** Permiso con los datos de la clínica, para la pantalla de consentimientos. */
export const permisoConClinicaSchema = permisoSchema.extend({
  clinica: clinicaSchema,
});
export type PermisoConClinica = z.infer<typeof permisoConClinicaSchema>;

export const otorgarPermisoSchema = z.object({
  clinicaId: idSchema,
  alcance: alcancePermisoSchema.default("completo"),
});
export type OtorgarPermiso = z.infer<typeof otorgarPermisoSchema>;

/** La revocación corta el acceso de inmediato; no se borra el registro. */
export const revocarPermisoSchema = z.object({
  permisoId: idSchema,
});
export type RevocarPermiso = z.infer<typeof revocarPermisoSchema>;

export const entradaBitacoraSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  usuarioId: idSchema.nullable(),
  accion: z.string().min(1).max(120),
  fecha: fechaHoraSchema,
});
export type EntradaBitacora = z.infer<typeof entradaBitacoraSchema>;
