import { z } from "zod";
import { fechaHoraSchema, idSchema } from "./comun.js";

/** Roles del sistema. Se corresponden con el enum `rol_usuario` de la base. */
export const rolUsuarioSchema = z.enum(["dueño", "clinica"]);
export type RolUsuario = z.infer<typeof rolUsuarioSchema>;

export const usuarioSchema = z.object({
  id: idSchema,
  correo: z.email(),
  nombre: z.string().min(1).max(120),
  rol: rolUsuarioSchema,
  telefono: z.string().max(30).nullable(),
  creadoEn: fechaHoraSchema,
});
export type Usuario = z.infer<typeof usuarioSchema>;

/**
 * Mínimo de seguridad para la contraseña. La validación vive aquí para que el
 * formulario del frontend y el API apliquen exactamente la misma regla.
 */
export const contrasenaSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(128);

export const registrarUsuarioSchema = z
  .object({
    correo: z.email(),
    nombre: z.string().min(1).max(120),
    contrasena: contrasenaSchema,
    rol: rolUsuarioSchema.default("dueño"),
    telefono: z.string().max(30).optional(),
    /** Solo para rol `clinica`: el registro crea la clínica y vincula al usuario. */
    nombreClinica: z.string().min(1).max(160).optional(),
  })
  .refine((datos) => datos.rol !== "clinica" || !!datos.nombreClinica, {
    message: "El nombre de la clínica es obligatorio",
    path: ["nombreClinica"],
  });
export type RegistrarUsuario = z.infer<typeof registrarUsuarioSchema>;

export const iniciarSesionSchema = z.object({
  correo: z.email(),
  contrasena: z.string().min(1, "La contraseña es obligatoria"),
});
export type IniciarSesion = z.infer<typeof iniciarSesionSchema>;

/** Respuesta de login y de refresco de sesión. */
export const sesionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  usuario: usuarioSchema,
});
export type Sesion = z.infer<typeof sesionSchema>;

export const refrescarSesionSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefrescarSesion = z.infer<typeof refrescarSesionSchema>;

/** Cerrar sesión invalida el refresh token de este dispositivo. */
export const cerrarSesionSchema = refrescarSesionSchema;
export type CerrarSesion = z.infer<typeof cerrarSesionSchema>;

/** Contenido del access token que emite el API. */
export const tokenPayloadSchema = z.object({
  sub: idSchema,
  correo: z.email(),
  rol: rolUsuarioSchema,
});
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
