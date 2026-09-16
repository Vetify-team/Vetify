import { describe, expect, it } from 'vitest';
import { entornoSchema, validarEntorno } from '../src/configuracion.js';

const entornoValido = {
  DATABASE_URL: 'postgresql://usuario:clave@localhost:5432/vetify',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('configuración del API', () => {
  it('acepta un entorno completo y aplica los valores por defecto', () => {
    const entorno = validarEntorno(entornoValido);

    expect(entorno.PORT).toBe(3001);
    expect(entorno.NODE_ENV).toBe('development');
    expect(entorno.JWT_ACCESS_TTL).toBe('15m');
  });

  it('falla si falta DATABASE_URL', () => {
    const { DATABASE_URL: _omitida, ...sinBase } = entornoValido;

    expect(() => validarEntorno(sinBase)).toThrow(/DATABASE_URL/);
  });

  it('rechaza un secreto de JWT demasiado corto', () => {
    const resultado = entornoSchema.safeParse({ ...entornoValido, JWT_ACCESS_SECRET: 'corto' });

    expect(resultado.success).toBe(false);
  });
});
