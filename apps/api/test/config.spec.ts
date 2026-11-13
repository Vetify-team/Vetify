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
    expect(env.LLM_TIMEOUT_MS).toBe(15_000);
    expect(env.LLM_FALLBACK_TIMEOUT_MS).toBe(30_000);
  });

  it('reads the provider timeouts and rejects absurd ones', () => {
    expect(
      validateEnv({ ...validEnv, LLM_TIMEOUT_MS: '10000' }).LLM_TIMEOUT_MS,
    ).toBe(10_000);
    for (const value of ['0', '500', '600000', 'soon'])
      expect(() =>
        validateEnv({ ...validEnv, LLM_FALLBACK_TIMEOUT_MS: value }),
      ).toThrow(/LLM_FALLBACK_TIMEOUT_MS/);
  });

  it('retains the notification settings loaded from the environment', () => {
    const env = validateEnv({
      ...validEnv,
      DEV_PUSH_TEST_ENABLED: 'true',
      NOTIFICATIONS_WORKER_ENABLED: 'true',
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
      VAPID_SUBJECT: 'mailto:dev@example.test',
    });
    expect(env.DEV_PUSH_TEST_ENABLED).toBe('true');
    expect(env.NOTIFICATIONS_WORKER_ENABLED).toBe('true');
    expect(env.VAPID_PUBLIC_KEY).toBe('public');
    expect(env.VAPID_PRIVATE_KEY).toBe('private');
    expect(env.VAPID_SUBJECT).toBe('mailto:dev@example.test');
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
