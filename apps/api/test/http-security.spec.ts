import 'reflect-metadata';
import {
  Controller,
  Get,
  Module,
  NotFoundException,
  Req,
  VersioningType,
  type ExecutionContext,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { Request } from 'express';
import { AuthController } from '../src/auth/auth.controller.js';
import type { AuthService } from '../src/auth/auth.service.js';
import type { AccessLogService } from '../src/access-log/access-log.service.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { configureHttp } from '../src/common/http/configure-http.js';
import type { Env } from '../src/config.js';

const ORIGIN = 'https://vetify.example';
const PET_ID = '11111111-1111-4111-8111-111111111111';
const issued = {
  session: { accessToken: 'test-access-token', user: { role: 'owner' } },
  refreshToken: 'test-refresh-token',
  refreshExpiresAt: new Date(Date.now() + 60_000),
};
const auth = {
  logIn: vi.fn().mockResolvedValue(issued),
  signUp: vi.fn().mockResolvedValue(issued),
  refresh: vi.fn().mockResolvedValue(issued),
  logOut: vi.fn().mockResolvedValue(undefined),
};
const recordDenied = vi.fn().mockResolvedValue(undefined);
const config = {
  get: (key: string) =>
    ({ NODE_ENV: 'production', ALLOWED_ORIGINS: [ORIGIN] })[key],
};

// Explicit construction keeps HTTP tests independent of Vite's lack of
// emitted constructor metadata; inherited routes/pipes are the real ones.
@Controller({ path: 'auth', version: '1' })
class TestAuthController extends AuthController {
  constructor() {
    super(
      auth as unknown as AuthService,
      config as unknown as ConfigService<Env, true>,
    );
  }
}

@Controller({ path: 'pets/:petId', version: '1' })
class DenialController {
  @Roles('owner')
  @Get('owner-only')
  ownerOnly() {
    return { ok: true };
  }

  @Get('hidden')
  hidden() {
    throw new NotFoundException('Pet not found');
  }
}

@Controller({ path: 'ip', version: '1' })
class IpController {
  @Get()
  ip(@Req() request: Request) {
    return { ip: request.ip };
  }
}

@Module({ controllers: [TestAuthController, DenialController, IpController] })
class TestModule {}

describe('HTTP security boundaries', () => {
  let app: NestExpressApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(TestModule, {
      logger: false,
    });
    configureHttp(app, {
      TRUST_PROXY_HOPS: 1,
      TRUST_PROXY_CIDRS: ['192.0.2.0/24'],
      ALLOWED_ORIGINS: [ORIGIN],
    });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });
    app.useGlobalGuards(
      {
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<Request & { user: unknown }>().user = {
            sub: 'test-clinic',
            role: 'clinic',
          };
          return true;
        },
      },
      new RolesGuard(new Reflector()),
    );
    app.useGlobalFilters(
      new HttpExceptionFilter({ recordDenied } as unknown as AccessLogService),
    );
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores forged forwarding headers from outside the trusted proxy networks', async () => {
    for (const ip of ['198.51.100.1', '198.51.100.2']) {
      const response = await fetch(`${base}/api/v1/ip`, {
        headers: { 'X-Forwarded-For': ip },
      });
      expect((await response.json()).ip).toBe('127.0.0.1');
    }
  });

  it.each(['login', 'register'])(
    'rejects cross-origin JSON %s without issuing a session',
    async (action) => {
      const response = await fetch(`${base}/api/v1/auth/${action}`, {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.test',
          name: 'Test',
          password: 'test-password-long',
        }),
      });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('INVALID_ORIGIN');
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(auth.logIn).not.toHaveBeenCalled();
      expect(auth.signUp).not.toHaveBeenCalled();
    },
  );

  it.each(['login', 'register'])(
    'rejects simple cross-origin form %s before authentication',
    async (action) => {
      const response = await fetch(`${base}/api/v1/auth/${action}`, {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
        body: new URLSearchParams({
          email: 'test@example.test',
          password: 'test-password-long',
          name: 'Test',
        }),
      });
      expect(response.status).toBe(415);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(auth.logIn).not.toHaveBeenCalled();
      expect(auth.signUp).not.toHaveBeenCalled();
    },
  );

  it('blocks an Origin-less cross-site request and an opaque Origin', async () => {
    const cases: Record<string, string>[] = [
      { 'Sec-Fetch-Site': 'cross-site' },
      { Origin: 'null' },
    ];
    for (const headers of cases) {
      const response = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.test',
          password: 'test-password-long',
        }),
      });
      expect(response.status).toBe(403);
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  });

  it('accepts allowed browser login and cookie-less CLI login, with secure cookies', async () => {
    for (const origin of [ORIGIN, undefined]) {
      const response = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({
          email: 'test@example.test',
          password: 'test-password-long',
        }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toMatch(
        /HttpOnly; Secure; SameSite=Strict/,
      );
    }
    expect(auth.logIn).toHaveBeenCalledTimes(2);
  });

  it.each(['refresh', 'logout'])(
    'blocks cross-origin %s before touching the session',
    async (action) => {
      const response = await fetch(`${base}/api/v1/auth/${action}`, {
        method: 'POST',
        headers: {
          Origin: 'https://attacker.example',
          Cookie: 'vetify_refresh=test',
        },
      });
      expect(response.status).toBe(403);
      expect(auth.refresh).not.toHaveBeenCalled();
      expect(auth.logOut).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: 'oversized JSON',
      body: JSON.stringify({ padding: 'a'.repeat(103_000) }),
      status: 413,
    },
    { name: 'malformed JSON', body: '{', status: 400 },
  ])(
    'protects $name errors with cache and security headers',
    async ({ body, status }) => {
      const response = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(response.headers.has('x-powered-by')).toBe(false);
      expect(auth.logIn).not.toHaveBeenCalled();
    },
  );

  it.each([
    { path: 'owner-only', status: 403 },
    { path: 'hidden', status: 404 },
  ])(
    'audits a $status denial, including failures before interceptors',
    async ({ path, status }) => {
      const response = await fetch(`${base}/api/v1/pets/${PET_ID}/${path}`);
      expect(response.status).toBe(status);
      expect(recordDenied).toHaveBeenCalledExactlyOnceWith(
        PET_ID,
        'test-clinic',
      );
    },
  );
});
