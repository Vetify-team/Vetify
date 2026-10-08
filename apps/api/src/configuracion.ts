import { z } from 'zod';

/**
 * Variables de entorno del API. Se validan al arrancar: si falta una, el
 * proceso no levanta, en vez de fallar a mitad de una petición.
 */
export const entornoSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Entorno = z.infer<typeof entornoSchema>;

export const validarEntorno = (entorno: Record<string, unknown>): Entorno => {
  const resultado = entornoSchema.safeParse(entorno);

  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${detalle}`);
  }

  return resultado.data;
};
