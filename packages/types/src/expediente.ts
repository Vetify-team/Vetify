import { z } from "zod";
import { fechaHoraSchema, fechaSchema, idSchema } from "./comun.js";
import { especieSchema } from "./mascota.js";

// ---------- Acto médico: lo registra la clínica con permiso activo ----------

export const consultaSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  clinicaId: idSchema.nullable(),
  veterinarioId: idSchema.nullable(),
  fecha: fechaHoraSchema,
  motivo: z.string().max(300).nullable(),
  diagnostico: z.string().max(2000).nullable(),
  notas: z.string().max(4000).nullable(),
});
export type Consulta = z.infer<typeof consultaSchema>;

export const crearConsultaSchema = z.object({
  fecha: fechaHoraSchema.optional(),
  motivo: z.string().max(300).optional(),
  diagnostico: z.string().max(2000).optional(),
  notas: z.string().max(4000).optional(),
});
export type CrearConsulta = z.infer<typeof crearConsultaSchema>;

export const vacunaSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  tipo: z.string().min(1).max(120),
  lote: z.string().max(60).nullable(),
  fechaAplicacion: fechaSchema,
  fechaVencimiento: fechaSchema.nullable(),
  clinicaId: idSchema.nullable(),
});
export type Vacuna = z.infer<typeof vacunaSchema>;

export const crearVacunaSchema = z.object({
  tipo: z.string().min(1, "El tipo de vacuna es obligatorio").max(120),
  lote: z.string().max(60).optional(),
  fechaAplicacion: fechaSchema,
  fechaVencimiento: fechaSchema.optional(),
});
export type CrearVacuna = z.infer<typeof crearVacunaSchema>;

export const desparasitacionSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  producto: z.string().max(120).nullable(),
  // 'interna' o 'externa'; se deja como texto libre igual que en la base.
  tipo: z.string().max(40).nullable(),
  fecha: fechaSchema,
  proximaFecha: fechaSchema.nullable(),
});
export type Desparasitacion = z.infer<typeof desparasitacionSchema>;

export const crearDesparasitacionSchema = z.object({
  producto: z.string().max(120).optional(),
  tipo: z.string().max(40).optional(),
  fecha: fechaSchema,
  proximaFecha: fechaSchema.optional(),
});
export type CrearDesparasitacion = z.infer<typeof crearDesparasitacionSchema>;

export const tratamientoSchema = z.object({
  id: idSchema,
  consultaId: idSchema.nullable(),
  mascotaId: idSchema,
  descripcion: z.string().min(1).max(2000),
  inicio: fechaSchema.nullable(),
  fin: fechaSchema.nullable(),
});
export type Tratamiento = z.infer<typeof tratamientoSchema>;

export const crearTratamientoSchema = z.object({
  consultaId: idSchema.optional(),
  descripcion: z.string().min(1, "La descripción es obligatoria").max(2000),
  inicio: fechaSchema.optional(),
  fin: fechaSchema.optional(),
});
export type CrearTratamiento = z.infer<typeof crearTratamientoSchema>;

export const examenSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  tipo: z.string().max(120).nullable(),
  fecha: fechaSchema,
  archivoUrl: z.url().nullable(),
  resultado: z.string().max(4000).nullable(),
});
export type Examen = z.infer<typeof examenSchema>;

export const crearExamenSchema = z.object({
  tipo: z.string().max(120).optional(),
  fecha: fechaSchema,
  archivoUrl: z.url().optional(),
  resultado: z.string().max(4000).optional(),
});
export type CrearExamen = z.infer<typeof crearExamenSchema>;

// ---------- Día a día: lo registra el dueño ----------

export const registroPesoSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  fecha: fechaSchema,
  pesoKg: z.number().positive().max(200),
});
export type RegistroPeso = z.infer<typeof registroPesoSchema>;

export const crearRegistroPesoSchema = z.object({
  fecha: fechaSchema.optional(),
  pesoKg: z.number().positive("El peso debe ser mayor que cero").max(200),
});
export type CrearRegistroPeso = z.infer<typeof crearRegistroPesoSchema>;

export const registroAlimentacionSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  fecha: fechaSchema,
  detalle: z.string().max(1000).nullable(),
});
export type RegistroAlimentacion = z.infer<typeof registroAlimentacionSchema>;

export const crearRegistroAlimentacionSchema = z.object({
  fecha: fechaSchema.optional(),
  detalle: z.string().max(1000).optional(),
});
export type CrearRegistroAlimentacion = z.infer<typeof crearRegistroAlimentacionSchema>;

// ---------- Esquema preventivo y recordatorios ----------

export const esquemaVacunacionSchema = z.object({
  id: idSchema,
  pais: z.string().length(2),
  especie: especieSchema,
  vacuna: z.string().min(1).max(120),
  edadMinimaMeses: z.number().int().min(0).nullable(),
  intervaloMeses: z.number().int().min(0).nullable(),
  vigenciaMeses: z.number().int().min(1),
});
export type EsquemaVacunacion = z.infer<typeof esquemaVacunacionSchema>;

export const recordatorioSchema = z.object({
  id: idSchema,
  mascotaId: idSchema,
  // 'vacuna' | 'desparasitacion' | 'peso'; texto libre como en la base.
  tipo: z.string().min(1).max(40),
  fechaObjetivo: fechaSchema,
  canal: z.string().max(20),
  estado: z.string().max(20),
});
export type Recordatorio = z.infer<typeof recordatorioSchema>;

/**
 * Estado de una vacuna del esquema para una mascota concreta:
 * - `vigente`: aplicada y con protección por más de 30 días.
 * - `por_vencer`: aplicada, vence en 30 días o menos.
 * - `vencida`: aplicada, pero la protección ya expiró.
 * - `pendiente`: nunca aplicada y la mascota ya tiene la edad mínima.
 * - `no_aplica_aun`: la mascota todavía no alcanza la edad mínima.
 */
export const estadoVacunaSchema = z.enum([
  "vigente",
  "por_vencer",
  "vencida",
  "pendiente",
  "no_aplica_aun",
]);
export type EstadoVacuna = z.infer<typeof estadoVacunaSchema>;

export const vacunaDelEsquemaSchema = z.object({
  vacuna: z.string(),
  estado: estadoVacunaSchema,
  ultimaAplicacion: fechaSchema.nullable(),
  fechaVencimiento: fechaSchema.nullable(),
  /** Cuándo toca aplicarla: vencimiento, edad mínima o null si ya está atrasada. */
  proximaFecha: fechaSchema.nullable(),
});
export type VacunaDelEsquema = z.infer<typeof vacunaDelEsquemaSchema>;

/**
 * Última desparasitación de cada tipo (interna / externa) y cuándo toca la
 * siguiente. Usa los mismos estados que las vacunas; sin próxima fecha
 * registrada se considera `vigente`.
 */
export const estadoDesparasitacionSchema = z.object({
  tipo: z.string().nullable(),
  producto: z.string().nullable(),
  ultimaAplicacion: fechaSchema,
  proximaFecha: fechaSchema.nullable(),
  estado: estadoVacunaSchema,
});
export type EstadoDesparasitacion = z.infer<typeof estadoDesparasitacionSchema>;

/** Resultado de cruzar el esquema del país y especie con las vacunas aplicadas. */
export const estadoVacunacionSchema = z.object({
  pais: z.string().length(2),
  especie: especieSchema,
  /** Porcentaje del esquema con protección vigente (incluye `por_vencer`). */
  cobertura: z.number().min(0).max(100),
  vacunas: z.array(vacunaDelEsquemaSchema),
  desparasitaciones: z.array(estadoDesparasitacionSchema),
});
export type EstadoVacunacion = z.infer<typeof estadoVacunacionSchema>;

/**
 * Próxima dosis o dosis atrasada de una mascota. Al dueño le llegan las de sus
 * mascotas; a la clínica, las de sus pacientes con permiso activo.
 */
export const avisoSchema = z.object({
  mascotaId: idSchema,
  mascotaNombre: z.string(),
  tipo: z.enum(["vacuna", "desparasitacion"]),
  /** Nombre de la vacuna o tipo de desparasitación. */
  nombre: z.string(),
  /** Fecha objetivo: vencimiento, próxima dosis o desde cuándo corresponde. */
  fecha: fechaSchema.nullable(),
  estado: estadoVacunaSchema,
});
export type Aviso = z.infer<typeof avisoSchema>;

/** Nombre de quien participó en el expediente, para mostrar "Dra. X · Clínica Y". */
export const participanteSchema = z.object({ id: idSchema, nombre: z.string() });
export type Participante = z.infer<typeof participanteSchema>;

/** Expediente completo de una mascota, tal como lo devuelve el API. */
export const expedienteSchema = z.object({
  /** Clínicas y veterinarios referidos por los registros, para resolver nombres. */
  clinicas: z.array(participanteSchema),
  veterinarios: z.array(participanteSchema),
  consultas: z.array(consultaSchema),
  vacunas: z.array(vacunaSchema),
  desparasitaciones: z.array(desparasitacionSchema),
  tratamientos: z.array(tratamientoSchema),
  examenes: z.array(examenSchema),
  registrosPeso: z.array(registroPesoSchema),
  registrosAlimentacion: z.array(registroAlimentacionSchema),
});
export type Expediente = z.infer<typeof expedienteSchema>;
