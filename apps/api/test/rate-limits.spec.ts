import 'reflect-metadata';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthController } from '../src/auth/auth.controller.js';
import { ClinicsController } from '../src/clinics/clinics.controller.js';
import {
  type IpRateLimitVariable,
  ipThrottle,
  resetIpRateLimits,
  throttlers,
} from '../src/common/http/rate-limits.js';
import { type Env, validateEnv } from '../src/config.js';
import { PermissionsController } from '../src/permissions/permissions.controller.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/vetify',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  LINK_CODE_SECRET: 'c'.repeat(32),
};

/** The limits before they became configurable. Written out on purpose. */
const HISTORICAL = {
  RATE_LIMIT_GENERAL: 120,
  RATE_LIMIT_REGISTER: 10,
  RATE_LIMIT_LOGIN: 10,
  RATE_LIMIT_REFRESH: 30,
  RATE_LIMIT_LINK_CODE_CREATE: 10,
  RATE_LIMIT_LINK_CODE_PREVIEW: 10,
  RATE_LIMIT_PERMISSION_GRANT: 10,
} satisfies Record<IpRateLimitVariable, number>;

const fromEnv = (env: Env) => (variable: IpRateLimitVariable) => env[variable];

/** Each configurable route: its handler and the variable that sets it. */
const ROUTES = [
  ['POST /auth/register', AuthController, 'register', 'RATE_LIMIT_REGISTER'],
  ['POST /auth/login', AuthController, 'login', 'RATE_LIMIT_LOGIN'],
  ['POST /auth/refresh', AuthController, 'refresh', 'RATE_LIMIT_REFRESH'],
  [
    'POST /clinics/mine/link-codes',
    ClinicsController,
    'issueLinkCode',
    'RATE_LIMIT_LINK_CODE_CREATE',
  ],
  [
    'POST /link-codes/preview',
    ClinicsController,
    'preview',
    'RATE_LIMIT_LINK_CODE_PREVIEW',
  ],
  [
    'POST /pets/:petId/permissions',
    PermissionsController,
    'grant',
    'RATE_LIMIT_PERMISSION_GRANT',
  ],
] as const;

const metadata = (key: string, controller: object, handler: string) =>
  Reflect.getMetadata(
    key,
    (controller as { prototype: Record<string, object> }).prototype[handler]!,
  ) as unknown;

const resolve = (value: unknown) =>
  typeof value === 'function' ? (value as () => number)() : value;

afterEach(resetIpRateLimits);

describe('configurable per-IP rate limits', () => {
  it('keeps the historical values when nothing is configured', () => {
    const env = validateEnv(validEnv);
    expect(
      Object.fromEntries(
        Object.keys(HISTORICAL).map((key) => [
          key,
          env[key as IpRateLimitVariable],
        ]),
      ),
    ).toEqual(HISTORICAL);

    const [general] = throttlers(fromEnv(env));
    expect(resolve(general!.limit)).toBe(120);
    expect(general!.ttl).toBe(60_000);
  });

  it.each(ROUTES)(
    '%s keeps its historical limit by default',
    (_route, controller, handler, variable) => {
      throttlers(fromEnv(validateEnv(validEnv)));
      expect(
        resolve(metadata('THROTTLER:LIMITgeneral', controller, handler)),
      ).toBe(HISTORICAL[variable]);
      expect(metadata('THROTTLER:TTLgeneral', controller, handler)).toBe(
        60_000,
      );
    },
  );

  it.each(ROUTES)(
    '%s takes its own variable',
    (_route, controller, handler, variable) => {
      throttlers(fromEnv(validateEnv({ ...validEnv, [variable]: '777' })));
      expect(
        resolve(metadata('THROTTLER:LIMITgeneral', controller, handler)),
      ).toBe(777);
    },
  );

  it('raises the general limit with RATE_LIMIT_GENERAL', () => {
    const [general] = throttlers(
      fromEnv(validateEnv({ ...validEnv, RATE_LIMIT_GENERAL: '600' })),
    );
    expect(resolve(general!.limit)).toBe(600);
  });

  it('leaves the per-account limits fixed', () => {
    throttlers(
      fromEnv(
        validateEnv({
          ...validEnv,
          RATE_LIMIT_REGISTER: '500',
          RATE_LIMIT_LOGIN: '500',
        }),
      ),
    );
    for (const handler of ['register', 'login']) {
      expect(metadata('THROTTLER:LIMITaccount', AuthController, handler)).toBe(
        5,
      );
    }
    const [, account] = throttlers(fromEnv(validateEnv(validEnv)));
    expect(account!.limit).toBe(1_000);
  });

  it.each(['0', '-5', '2.5', 'many', '100001'])(
    'rejects %s as a limit instead of turning the limit off',
    (value) => {
      expect(() =>
        validateEnv({ ...validEnv, RATE_LIMIT_LOGIN: value }),
      ).toThrow(/RATE_LIMIT_LOGIN/);
    },
  );
});

@Controller()
class ProbeController {
  @Throttle({ general: ipThrottle('login') })
  @Get('probe')
  probe() {
    return 'ok';
  }
}

describe('configurable per-IP rate limits over HTTP', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const statuses = async (env: Env, requests: number) => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlers(fromEnv(env)))],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/probe`;
    const answered: number[] = [];
    for (let i = 0; i < requests; i++) answered.push((await fetch(url)).status);
    return answered;
  };

  it('blocks the 11th log-in a minute from one IP by default', async () => {
    const answered = await statuses(validateEnv(validEnv), 11);
    expect(answered.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(answered[10]).toBe(429);
  });

  it('applies the configured value', async () => {
    const answered = await statuses(
      validateEnv({ ...validEnv, RATE_LIMIT_LOGIN: '3' }),
      4,
    );
    expect(answered).toEqual([200, 200, 200, 429]);
  });
});
