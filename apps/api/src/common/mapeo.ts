import type { RolUsuario } from '@vetify/types';
import type { RolUsuario as RolPrisma } from '../generated/prisma/client.js';

/**
 * Conversión entre lo que devuelve Prisma y los contratos de @vetify/types.
 * Las columnas `date` se exponen como AAAA-MM-DD y las `timestamptz` en ISO.
 */

export const aFecha = (fecha: Date): string => fecha.toISOString().slice(0, 10);

export const aFechaOpcional = (fecha: Date | null): string | null =>
  fecha ? aFecha(fecha) : null;

export const aFechaHora = (fecha: Date): string => fecha.toISOString();

/** AAAA-MM-DD → Date a medianoche UTC, que es como Prisma guarda una columna `date`. */
export const desdeFecha = (fecha: string): Date =>
  new Date(`${fecha}T00:00:00.000Z`);

export const desdeFechaOpcional = (
  fecha: string | undefined,
): Date | undefined => (fecha ? desdeFecha(fecha) : undefined);

// Prisma no admite "ñ" en un identificador de enum, así que el valor del
// cliente es `dueno` y se mapea a `dueño` en la base y en el contrato.
export const aRol = (rol: RolPrisma): RolUsuario =>
  rol === 'dueno' ? 'dueño' : 'clinica';

export const desdeRol = (rol: RolUsuario): RolPrisma =>
  rol === 'dueño' ? 'dueno' : 'clinica';
