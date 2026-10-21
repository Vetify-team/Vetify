import { describe, expect, it } from 'vitest';
import { docsEnabled, envSchema, validateEnv } from '../src/config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/vetify',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  LINK_CODE_SECRET: 'c'.repeat(32),
};

describe('API configuration', () => {
  it('accepts a complete environment and applies defaults', () => {
    const env = validateEnv(validEnv);
    expect(env.PORT).toBe(3001);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.ALLOWED_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
    expect(env.TRUST_PROXY_CIDRS).toEqual([]);
  });

  it('fails without DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = validEnv;
    expect(() => validateEnv(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it.each(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'LINK_CODE_SECRET'])(
    'rejects a short %s',
    (key) => {
      expect(envSchema.safeParse({ ...validEnv, [key]: 'short' }).success).toBe(
        false,
      );
    },
  );

  it('splits several allowed origins', () => {
    const env = validateEnv({
      ...validEnv,
      ALLOWED_ORIGINS: 'https://vetify.app, https://www.vetify.app',
    });
    expect(env.ALLOWED_ORIGINS).toEqual([
      'https://vetify.app',
      'https://www.vetify.app',
    ]);
  });

  it('turns the docs off in production unless explicitly enabled', () => {
    expect(
      docsEnabled({ NODE_ENV: 'development', API_DOCS_ENABLED: undefined }),
    ).toBe(true);
    expect(
      docsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: undefined }),
    ).toBe(false);
    expect(
      docsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: true }),
    ).toBe(true);
  });

  it('rejects blind multi-hop trust and accepts explicit proxy networks', () => {
    expect(() => validateEnv({ ...validEnv, TRUST_PROXY_HOPS: 2 })).toThrow(
      /TRUST_PROXY/,
    );
    expect(
      validateEnv({
        ...validEnv,
        TRUST_PROXY_CIDRS: '10.0.0.1/32, 2001:db8::/64',
      }).TRUST_PROXY_CIDRS,
    ).toEqual(['10.0.0.1/32', '2001:db8::/64']);
    for (const value of [
      'anything',
      '10.0.0.1/33',
      '2001:db8::/129',
      '10.0.0.1/-1',
      '10.0.0.1/24/extra',
      '0.0.0.0/0',
      '::/0',
    ]) {
      expect(() =>
        validateEnv({ ...validEnv, TRUST_PROXY_CIDRS: value }),
      ).toThrow(/TRUST_PROXY_CIDRS/);
    }
  });
});
