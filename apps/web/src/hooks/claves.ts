/**
 * Claves de TanStack Query centralizadas: así una mutación sabe exactamente
 * qué invalidar y no se escriben strings sueltos por toda la app.
 */
export const claves = {
  sesion: ["sesion"] as const,
  mascotas: () => ["mascotas"] as const,
  mascota: (id: string) => ["mascotas", id] as const,
  expediente: (mascotaId: string) => ["mascotas", mascotaId, "expediente"] as const,
  pesos: (mascotaId: string) => ["mascotas", mascotaId, "pesos"] as const,
  permisos: (mascotaId: string) => ["mascotas", mascotaId, "permisos"] as const,
  bitacora: (mascotaId: string) => ["mascotas", mascotaId, "bitacora"] as const,
  anomalias: (mascotaId: string) => ["mascotas", mascotaId, "anomalias"] as const,
} as const;
