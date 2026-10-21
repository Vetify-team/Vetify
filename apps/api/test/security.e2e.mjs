import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PinoLogger } from 'nestjs-pino';
import * as argon2 from 'argon2';

// Never use DATABASE_URL implicitly, never accept a remote database, and never
// target an existing listening server. Every request goes to our own app on
// an ephemeral loopback port. Migrations must already be applied by the caller.
const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const strict = process.env.SECURITY_E2E_STRICT === '1';
assert.ok(
  databaseUrl,
  'Set SECURITY_TEST_DATABASE_URL to a migrated disposable local vetify_security_* database',
);
const url = new URL(databaseUrl);
assert.ok(
  ['postgres:', 'postgresql:'].includes(url.protocol) &&
    !url.search &&
    !url.hash &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    /^\/vetify_security_[a-z0-9_]+$/.test(url.pathname),
  'E2E tests refuse remote and non-security-test databases',
);
const origin = 'https://web.vetify.example';
const accessSecret = randomBytes(48).toString('base64');
Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  NODE_ENV: 'production',
  PORT: '0',
  JWT_ACCESS_SECRET: accessSecret,
  JWT_REFRESH_SECRET: randomBytes(48).toString('base64'),
  LINK_CODE_SECRET: randomBytes(48).toString('base64'),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  ALLOWED_ORIGINS: origin,
  TRUST_PROXY_HOPS: '0',
  TRUST_PROXY_CIDRS: '',
  API_DOCS_ENABLED: 'false',
});

// Import the compiled production module after installing the isolated env.
const { AppModule } = await import('../dist/app.module.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { configureHttp } = await import('../dist/common/http/configure-http.js');

async function start() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    (await app.resolve(PinoLogger)).logger.level = 'silent';
    configureHttp(app, {
      TRUST_PROXY_HOPS: 0,
      TRUST_PROXY_CIDRS: [],
      ALLOWED_ORIGINS: [origin],
    });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });
    await app.listen(0, '127.0.0.1');
    return { app, base: await app.getUrl(), db: app.get(PrismaService) };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function request(server, method, path, options = {}) {
  const {
    token,
    cookie,
    body,
    raw,
    headers = {},
    browserOrigin = origin,
  } = options;
  const response = await fetch(`${server.base}/api${path}`, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: {
      ...(browserOrigin ? { Origin: browserOrigin } : {}),
      ...(body !== undefined || raw !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(raw !== undefined
      ? { body: raw }
      : body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: response.status,
    data,
    headers: response.headers,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

function status(response, expected) {
  assert.equal(
    response.status,
    expected,
    `Expected HTTP ${expected}; received ${response.status} (${response.data?.code ?? 'no error code'})`,
  );
}

await test(
  'API adversarial E2E — real HTTP, production module, real PostgreSQL',
  { timeout: 90_000 },
  async (t) => {
    const server = await start();
    const { db } = server;
    const run = randomUUID();
    const password = randomBytes(24).toString('base64');
    const passwordHash = await argon2.hash(password);
    const userIds = new Set();
    const clinicIds = new Set();
    const sessions = {};
    let rateServer;
    t.after(async () => {
      try {
        // Only this run's fixtures, in a guarded disposable database.
        await db.pet.deleteMany({ where: { ownerId: { in: [...userIds] } } });
        await db.clinic.deleteMany({ where: { id: { in: [...clinicIds] } } });
        await db.user.deleteMany({ where: { id: { in: [...userIds] } } });
      } finally {
        await rateServer?.app.close();
        await server.app.close();
      }
    });

    for (const [name, role] of [
      ['owner', 'owner'],
      ['other', 'owner'],
      ['clinic', 'clinic'],
      ['secondClinic', 'clinic'],
      ['admin', 'admin'],
    ]) {
      const user = await db.user.create({
        data: {
          email: `${run}-${name.toLowerCase()}@e2e.test`,
          name: `E2E ${name}`,
          role,
          passwordHash,
        },
      });
      userIds.add(user.id);
      if (role === 'clinic') {
        const clinic = await db.clinic.create({
          data: { name: `E2E ${name}`, staff: { create: { userId: user.id } } },
        });
        clinicIds.add(clinic.id);
        user.clinicId = clinic.id;
      }
      const login = await request(server, 'POST', '/v1/auth/login', {
        body: { email: user.email, password },
      });
      status(login, 200);
      sessions[name] = {
        user,
        token: login.data.accessToken,
        cookie: login.cookie,
        login,
      };
    }
    const owner = sessions.owner;
    const other = sessions.other;
    const clinic = sessions.clinic;
    const secondClinic = sessions.secondClinic;
    const admin = sessions.admin;
    const ownerPet = await request(server, 'POST', '/v1/pets', {
      token: owner.token,
      body: { name: 'Private owner pet', species: 'dog', neutered: true },
    });
    const otherPet = await request(server, 'POST', '/v1/pets', {
      token: other.token,
      body: { name: 'Private other pet', species: 'dog' },
    });
    const secondPet = await request(server, 'POST', '/v1/pets', {
      token: owner.token,
      body: { name: 'Owner second pet', species: 'dog' },
    });
    for (const result of [ownerPet, otherPet, secondPet]) status(result, 201);
    const petId = ownerPet.data.id;
    const otherPetId = otherPet.data.id;
    const secondPetId = secondPet.data.id;
    const petPath = `/v1/pets/${petId}`;
    let permissionId;

    await t.test(
      'explicit version succeeds; omitted or conflicting versions are rejected',
      async () => {
        status(await request(server, 'GET', '/v1/health'), 200);
        status(
          await request(server, 'GET', '/health', {
            headers: { 'X-API-Version': '1' },
          }),
          200,
        );
        status(await request(server, 'GET', '/health'), 400);
        status(
          await request(server, 'GET', '/v1/health', {
            headers: { 'X-API-Version': '2' },
          }),
          400,
        );
      },
    );

    await t.test(
      'real password login issues protected cookies without leaking password hashes/refresh tokens',
      async () => {
        const cookie = owner.login.headers.get('set-cookie') ?? '';
        assert.ok(
          /HttpOnly/i.test(cookie) &&
            /Secure/i.test(cookie) &&
            /SameSite=Strict/i.test(cookie) &&
            /Path=\/api/.test(cookie),
        );
        assert.ok(!('refreshToken' in owner.login.data));
        assert.ok(!('passwordHash' in owner.login.data.user));
      },
    );

    const originalParts = owner.token.split('.');
    const payload = JSON.parse(
      Buffer.from(originalParts[1], 'base64url').toString(),
    );
    const altered = [
      originalParts[0],
      Buffer.from(
        JSON.stringify({ ...payload, role: 'admin', sub: admin.user.id }),
      ).toString('base64url'),
      originalParts[2],
    ].join('.');
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${originalParts[1]}.`;
    const jwt = new JwtService();
    for (const [name, token] of [
      ['missing token', undefined],
      ['malformed token', 'invalid'],
      ['altered identity/role', altered],
      ['alg=none', unsigned],
      ['refresh token used as access token', owner.cookie.split('=')[1]],
      [
        'expired signed token',
        await jwt.signAsync(
          { ...payload, exp: Math.floor(Date.now() / 1000) - 5 },
          { secret: accessSecret, algorithm: 'HS256' },
        ),
      ],
      [
        'wrong issuer',
        await jwt.signAsync(
          { ...payload, iss: 'attacker' },
          { secret: accessSecret, algorithm: 'HS256' },
        ),
      ],
      [
        'wrong audience',
        await jwt.signAsync(
          { ...payload, aud: 'other-service' },
          { secret: accessSecret, algorithm: 'HS256' },
        ),
      ],
      [
        'signed identity/session mismatch',
        await jwt.signAsync(
          { ...payload, sub: other.user.id },
          { secret: accessSecret, algorithm: 'HS256' },
        ),
      ],
    ]) {
      await t.test(`rejects ${name}`, async () =>
        status(await request(server, 'GET', '/v1/auth/me', { token }), 401),
      );
    }

    await t.test(
      'rejects attacker-origin JSON login without setting a session cookie',
      async () => {
        const response = await request(server, 'POST', '/v1/auth/login', {
          browserOrigin: 'https://attacker.example',
          body: { email: owner.user.email, password },
        });
        status(response, 403);
        assert.ok(!response.cookie);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
      },
    );
    await t.test('rejects form login even when Origin is absent', async () => {
      const response = await request(server, 'POST', '/v1/auth/login', {
        browserOrigin: null,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        raw: new URLSearchParams({
          email: owner.user.email,
          password,
        }).toString(),
      });
      status(response, 415);
      assert.ok(!response.cookie);
    });
    await t.test(
      'rejects an opaque Origin and Origin-less browser-declared cross-site login',
      async () => {
        const body = { email: other.user.email, password };
        status(
          await request(server, 'POST', '/v1/auth/login', {
            browserOrigin: 'null',
            body,
          }),
          403,
        );
        status(
          await request(server, 'POST', '/v1/auth/login', {
            browserOrigin: null,
            headers: { 'Sec-Fetch-Site': 'cross-site' },
            body,
          }),
          403,
        );
      },
    );
    await t.test(
      'rejects CSRF against refresh/logout while leaving the real session usable',
      async () => {
        for (const action of ['refresh', 'logout'])
          status(
            await request(server, 'POST', `/v1/auth/${action}`, {
              cookie: owner.cookie,
              browserOrigin: 'https://attacker.example',
            }),
            403,
          );
        status(
          await request(server, 'GET', '/v1/auth/me', { token: owner.token }),
          200,
        );
      },
    );
    await t.test('cannot self-register as admin', async () => {
      const response = await request(server, 'POST', '/v1/auth/register', {
        body: {
          email: `${run}-forged@e2e.test`,
          name: 'Forged admin',
          role: 'admin',
          password,
        },
      });
      if (response.data?.user?.id) userIds.add(response.data.user.id);
      status(response, 400);
    });
    await t.test(
      'real owner registration returns a usable session with no administrative privileges',
      async () => {
        const response = await request(server, 'POST', '/v1/auth/register', {
          body: {
            email: `${run}-registered@e2e.test`,
            name: 'E2E registered owner',
            password,
          },
        });
        if (response.data?.user?.id) userIds.add(response.data.user.id);
        status(response, 201);
        assert.equal(response.data.user.role, 'owner');
        assert.ok(!('refreshToken' in response.data));
        sessions.registered = {
          token: response.data.accessToken,
          cookie: response.cookie,
        };
        status(
          await request(server, 'GET', '/v1/auth/me', {
            token: sessions.registered.token,
          }),
          200,
        );
        status(
          await request(server, 'GET', '/v1/admin/clinics', {
            token: sessions.registered.token,
          }),
          403,
        );
      },
    );

    for (const suffix of [
      '',
      '/record',
      '/vaccination-status',
      '/permissions',
      '/access-log',
    ]) {
      await t.test(
        `another owner cannot read ${suffix || 'pet profile'}`,
        async () => {
          status(
            await request(server, 'GET', `${petPath}${suffix}`, {
              token: other.token,
            }),
            404,
          );
        },
      );
    }
    await t.test(
      'another owner cannot change the pet or write its day-to-day records',
      async () => {
        status(
          await request(server, 'PATCH', petPath, {
            token: other.token,
            body: { name: 'Hijacked' },
          }),
          404,
        );
        status(
          await request(server, 'POST', `${petPath}/weights`, {
            token: other.token,
            body: { weightKg: 11 },
          }),
          404,
        );
        assert.equal(
          (await request(server, 'GET', petPath, { token: owner.token })).data
            .name,
          'Private owner pet',
        );
      },
    );
    await t.test('owner lists contain no other account pets', async () => {
      const response = await request(server, 'GET', '/v1/pets', {
        token: other.token,
      });
      status(response, 200);
      assert.ok(response.data.every((pet) => pet.ownerId === other.user.id));
      assert.ok(!response.data.some((pet) => pet.id === petId));
    });
    await t.test(
      'mass assignment cannot transfer pet ownership or modify immutable fields',
      async () => {
        const created = await request(server, 'POST', '/v1/pets', {
          token: owner.token,
          body: {
            name: 'Mass assignment fixture',
            species: 'dog',
            ownerId: other.user.id,
            id: otherPetId,
            role: 'admin',
          },
        });
        status(created, 201);
        assert.equal(created.data.ownerId, owner.user.id);
        assert.notEqual(created.data.id, otherPetId);
        const patched = await request(server, 'PATCH', petPath, {
          token: owner.token,
          body: {
            name: 'Updated safely',
            ownerId: other.user.id,
            species: 'cat',
          },
        });
        status(patched, 200);
        assert.equal(patched.data.ownerId, owner.user.id);
        assert.equal(patched.data.species, 'dog');
        assert.equal(patched.data.neutered, true);
      },
    );
    await t.test(
      'roles cannot cross owner/clinic/admin boundaries',
      async () => {
        status(
          await request(server, 'GET', '/v1/admin/clinics', {
            token: owner.token,
          }),
          403,
        );
        status(
          await request(
            server,
            'POST',
            `/v1/admin/clinics/${clinic.user.clinicId}/verify`,
            { token: clinic.token },
          ),
          403,
        );
        status(
          await request(server, 'GET', petPath, { token: admin.token }),
          403,
        );
        status(
          await request(server, 'POST', '/v1/pets', {
            token: clinic.token,
            body: { name: 'Unauthorized', species: 'dog' },
          }),
          403,
        );
        status(
          await request(server, 'POST', `${petPath}/consultations`, {
            token: owner.token,
            body: { reason: 'Not a veterinarian' },
          }),
          403,
        );
      },
    );
    await t.test(
      'a clinic cannot see unshared records or issue codes before verification',
      async () => {
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          403,
        );
        status(
          await request(server, 'POST', '/v1/clinics/mine/link-codes', {
            token: clinic.token,
          }),
          403,
        );
        const response = await request(server, 'GET', '/v1/pets', {
          token: clinic.token,
        });
        status(response, 200);
        assert.equal(response.data.length, 0);
      },
    );
    await t.test(
      'admin verification, code preview, and owner consent enable only the intended clinic',
      async () => {
        status(
          await request(
            server,
            'POST',
            `/v1/admin/clinics/${clinic.user.clinicId}/verify`,
            { token: admin.token },
          ),
          200,
        );
        const code = await request(
          server,
          'POST',
          '/v1/clinics/mine/link-codes',
          { token: clinic.token },
        );
        status(code, 201);
        assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.data.code));
        const preview = await request(
          server,
          'POST',
          '/v1/link-codes/preview',
          { token: owner.token, body: { code: code.data.code } },
        );
        status(preview, 200);
        assert.equal(preview.data.clinic.id, clinic.user.clinicId);
        const grant = await request(server, 'POST', `${petPath}/permissions`, {
          token: owner.token,
          body: {
            code: code.data.code,
            scope: 'full',
            clinicId: secondClinic.user.clinicId,
          },
        });
        status(grant, 201);
        permissionId = grant.data.id;
        assert.equal(grant.data.clinicId, clinic.user.clinicId);
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          200,
        );
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: secondClinic.token,
          }),
          403,
        );
        status(
          await request(server, 'POST', `/v1/pets/${secondPetId}/permissions`, {
            token: owner.token,
            body: { code: code.data.code },
          }),
          400,
        );
      },
    );
    await t.test(
      'a clinic code can be consumed only once under concurrent HTTP requests',
      async () => {
        const code = await request(
          server,
          'POST',
          '/v1/clinics/mine/link-codes',
          { token: clinic.token },
        );
        status(code, 201);
        const attempts = await Promise.all(
          [0, 1].map(() =>
            request(server, 'POST', `/v1/pets/${secondPetId}/permissions`, {
              token: owner.token,
              body: { code: code.data.code },
            }),
          ),
        );
        assert.deepEqual(
          attempts.map((response) => response.status).sort((a, b) => a - b),
          [201, 400],
        );
        assert.equal(
          await db.permission.count({
            where: { petId: secondPetId, clinicId: clinic.user.clinicId },
          }),
          1,
        );
      },
    );
    await t.test('expired codes cannot grant access', async () => {
      const code = await request(
        server,
        'POST',
        '/v1/clinics/mine/link-codes',
        { token: clinic.token },
      );
      status(code, 201);
      await db.clinicLinkCode.updateMany({
        where: { clinicId: clinic.user.clinicId, usedAt: null },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      status(
        await request(server, 'POST', `/v1/pets/${secondPetId}/permissions`, {
          token: owner.token,
          body: { code: code.data.code },
        }),
        400,
      );
    });
    await t.test(
      'card-only consent cannot be escalated to full record or medical-write access',
      async () => {
        status(
          await request(
            server,
            'POST',
            `/v1/admin/clinics/${secondClinic.user.clinicId}/verify`,
            { token: admin.token },
          ),
          200,
        );
        const code = await request(
          server,
          'POST',
          '/v1/clinics/mine/link-codes',
          { token: secondClinic.token },
        );
        status(code, 201);
        status(
          await request(server, 'POST', `${petPath}/permissions`, {
            token: owner.token,
            body: { code: code.data.code, scope: 'card_only' },
          }),
          201,
        );
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: secondClinic.token,
          }),
          403,
        );
        status(
          await request(server, 'POST', `${petPath}/vaccinations`, {
            token: secondClinic.token,
            body: { vaccine: 'Rabia', appliedOn: '2026-01-01' },
          }),
          403,
        );
      },
    );
    await t.test(
      'medical authorship comes from the authenticated clinic, not supplied IDs',
      async () => {
        const response = await request(
          server,
          'POST',
          `${petPath}/consultations`,
          {
            token: clinic.token,
            body: {
              reason: 'E2E consultation',
              clinicId: secondClinic.user.clinicId,
              veterinarianId: admin.user.id,
              petId: otherPetId,
            },
          },
        );
        status(response, 201);
        assert.equal(response.data.petId, petId);
        assert.equal(response.data.clinicId, clinic.user.clinicId);
        assert.equal(response.data.veterinarianId, clinic.user.id);
        status(
          await request(server, 'POST', `${petPath}/weights`, {
            token: clinic.token,
            body: { weightKg: 12 },
          }),
          403,
        );
      },
    );
    await t.test(
      'a foreign consultation ID cannot attach another pet history to a treatment',
      async () => {
        const consultation = await request(
          server,
          'POST',
          `/v1/pets/${secondPetId}/consultations`,
          { token: clinic.token, body: { reason: 'Different pet' } },
        );
        status(consultation, 201);
        status(
          await request(server, 'POST', `${petPath}/treatments`, {
            token: clinic.token,
            body: {
              consultationId: consultation.data.id,
              description: 'Attempted cross-pet attachment',
            },
          }),
          400,
        );
      },
    );
    await t.test(
      'permission IDs cannot be used against a different pet',
      async () => {
        status(
          await request(
            server,
            'POST',
            `/v1/pets/${otherPetId}/permissions/${permissionId}/revoke`,
            { token: other.token },
          ),
          404,
        );
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          200,
        );
      },
    );
    await t.test(
      'revoking consent blocks subsequent clinic reads and writes immediately',
      async () => {
        status(
          await request(
            server,
            'POST',
            `${petPath}/permissions/${permissionId}/revoke`,
            { token: owner.token },
          ),
          200,
        );
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          403,
        );
        status(
          await request(server, 'POST', `${petPath}/vaccinations`, {
            token: clinic.token,
            body: { vaccine: 'Rabia', appliedOn: '2026-01-01' },
          }),
          403,
        );
        status(
          await request(
            server,
            'POST',
            `${petPath}/permissions/${permissionId}/restore`,
            { token: owner.token },
          ),
          200,
        );
      },
    );

    /** @type {Array<[string, Record<string, unknown>]>} */
    const invalidPetCases = [
      [
        'javascript URL',
        { name: 'Bad URL', species: 'dog', photoUrl: 'javascript:alert(1)' },
      ],
      [
        'plaintext URL',
        {
          name: 'Bad URL',
          species: 'dog',
          photoUrl: 'http://example.test/pet.png',
        },
      ],
      [
        'metadata IP URL',
        {
          name: 'Bad URL',
          species: 'dog',
          photoUrl: 'https://169.254.169.254/latest/meta-data/',
        },
      ],
      [
        'control characters',
        { name: 'Injected\r\nHeader: value', species: 'dog' },
      ],
      [
        'extreme future date',
        { name: 'Future', species: 'dog', birthDate: '9999-12-31' },
      ],
    ];
    for (const [name, body] of invalidPetCases)
      await t.test(`rejects ${name}`, async () =>
        status(
          await request(server, 'POST', '/v1/pets', {
            token: owner.token,
            body,
          }),
          400,
        ),
      );

    await t.test(
      'SQL-like identifiers and malformed/oversized bodies fail without internals',
      async () => {
        status(
          await request(
            server,
            'GET',
            `/v1/pets/${encodeURIComponent("' OR 1=1--")}`,
            { token: owner.token },
          ),
          400,
        );
        for (const [raw, expected] of [
          ['{', 400],
          [JSON.stringify({ padding: 'a'.repeat(103_000) }), 413],
        ]) {
          const response = await request(server, 'POST', '/v1/pets', {
            token: owner.token,
            raw,
          });
          status(response, expected);
          assert.equal(response.headers.get('cache-control'), 'no-store');
          assert.equal(
            response.headers.get('x-content-type-options'),
            'nosniff',
          );
          assert.ok(!JSON.stringify(response.data).includes('stack'));
        }
      },
    );
    await t.test(
      'history and access-log pagination enforce limits and validate identifiers',
      async () => {
        for (const suffix of [
          '/record?limit=101',
          '/record?limit=-1',
          '/record?section=passwordHash',
          '/record?cursor=invalid',
          '/access-log?limit=10000',
        ]) {
          status(
            await request(server, 'GET', `${petPath}${suffix}`, {
              token: owner.token,
            }),
            400,
          );
        }
        await db.feedingEntry.createMany({
          data: Array.from({ length: 6 }, (_, i) => ({
            petId,
            notes: `E2E observation ${i}`,
            recordedOn: new Date('2026-01-01'),
          })),
        });
        const first = await request(
          server,
          'GET',
          `${petPath}/record?section=feedingEntries&limit=3`,
          { token: owner.token },
        );
        status(first, 200);
        assert.equal(first.data.feedingEntries.length, 3);
        const next = await request(
          server,
          'GET',
          `${petPath}/record?section=feedingEntries&limit=3&cursor=${first.data.nextCursors.feedingEntries}`,
          { token: owner.token },
        );
        status(next, 200);
        assert.equal(
          new Set(
            [...first.data.feedingEntries, ...next.data.feedingEntries].map(
              (row) => row.id,
            ),
          ).size,
          6,
        );
      },
    );
    await t.test(
      'real authorization denials appear in the owner access log',
      async () => {
        const response = await request(server, 'GET', `${petPath}/access-log`, {
          token: owner.token,
        });
        status(response, 200);
        assert.ok(
          response.data.items.some(
            (entry) =>
              entry.action === 'access_denied' &&
              entry.userId === other.user.id,
          ),
        );
        assert.ok(
          response.data.items.some(
            (entry) =>
              entry.action === 'access_denied' &&
              entry.userId === clinic.user.id,
          ),
        );
      },
    );
    await t.test(
      'KNOWN LIMIT: an active copied bearer token works from another HTTP client',
      async () => {
        const response = await request(server, 'GET', '/v1/auth/me', {
          token: owner.token,
          headers: { 'User-Agent': 'Different E2E client' },
        });
        status(response, 200);
        assert.equal(response.data.id, owner.user.id);
      },
    );
    await t.test(
      'all seven record routes deduplicate concurrent keyed writes',
      async () => {
        const cases = [
          ['consultations', clinic.token, { reason: 'Retry-safe visit' }],
          [
            'vaccinations',
            clinic.token,
            {
              vaccine: 'Rabia',
              appliedOn: '2026-01-01',
              expiresOn: '2027-01-01',
            },
          ],
          [
            'dewormings',
            clinic.token,
            {
              product: 'Test',
              appliedOn: '2026-01-01',
              nextDueOn: '2027-01-01',
            },
          ],
          ['treatments', clinic.token, { description: 'Retry-safe treatment' }],
          ['exams', clinic.token, { performedOn: '2026-01-01', kind: 'Test' }],
          ['weights', owner.token, { weightKg: 13 }],
          ['feedings', owner.token, { notes: 'Retry-safe observation' }],
        ];
        for (const [route, token, body] of cases) {
          const before = await db.reminder.count({ where: { petId } });
          const options = {
            token,
            body,
            headers: { 'Idempotency-Key': randomUUID() },
          };
          const results = await Promise.all([
            request(server, 'POST', `${petPath}/${route}`, options),
            request(server, 'POST', `${petPath}/${route}`, options),
          ]);
          results.forEach((result) => status(result, 201));
          assert.deepEqual(results[0].data, results[1].data);
          if (route === 'vaccinations' || route === 'dewormings') {
            assert.equal(
              await db.reminder.count({ where: { petId } }),
              before + 1,
            );
          }
        }
      },
    );
    await t.test(
      'keyed pet creation replays its response and rejects changed data',
      async () => {
        const key = randomUUID();
        const options = {
          token: owner.token,
          headers: { 'Idempotency-Key': key },
          body: { name: 'Retry-safe pet', species: 'dog' },
        };
        const results = await Promise.all([
          request(server, 'POST', '/v1/pets', options),
          request(server, 'POST', '/v1/pets', options),
        ]);
        results.forEach((result) => status(result, 201));
        assert.deepEqual(results[0].data, results[1].data);
        const conflict = await request(server, 'POST', '/v1/pets', {
          ...options,
          body: { ...options.body, name: 'Changed' },
        });
        status(conflict, 409);
        assert.equal(conflict.data.code, 'IDEMPOTENCY_CONFLICT');
        const isolated = await request(server, 'POST', '/v1/pets', {
          ...options,
          token: other.token,
        });
        status(isolated, 201);
        assert.notEqual(isolated.data.id, results[0].data.id);
      },
    );
    await t.test(
      'replay rechecks clinic consent and role authorization',
      async () => {
        const options = {
          token: clinic.token,
          headers: { 'Idempotency-Key': randomUUID() },
          body: { reason: 'Replay consent check' },
        };
        status(
          await request(server, 'POST', `${petPath}/consultations`, options),
          201,
        );
        await db.permission.update({
          where: { id: permissionId },
          data: { status: 'revoked' },
        });
        try {
          status(
            await request(server, 'POST', `${petPath}/consultations`, options),
            403,
          );
        } finally {
          await db.permission.update({
            where: { id: permissionId },
            data: { status: 'active' },
          });
        }
        // Another owner can neither execute nor replay this request.
        status(
          await request(server, 'POST', `${petPath}/consultations`, {
            ...options,
            token: other.token,
          }),
          403,
        );
      },
    );
    await t.test('invalid keys fail without creating a write', async () => {
      const before = await db.weightEntry.count({ where: { petId } });
      for (const key of [
        'short',
        'x'.repeat(129),
        'contains invalid whitespace',
      ]) {
        status(
          await request(server, 'POST', `${petPath}/weights`, {
            token: owner.token,
            headers: { 'Idempotency-Key': key },
            body: { weightKg: 11 },
          }),
          400,
        );
      }
      assert.equal(await db.weightEntry.count({ where: { petId } }), before);
    });
    await t.test(
      'keys are isolated by resource and expire after their retry window',
      async () => {
        const options = {
          token: owner.token,
          headers: { 'Idempotency-Key': randomUUID() },
          body: { weightKg: 14 },
        };
        const first = await request(
          server,
          'POST',
          `${petPath}/weights`,
          options,
        );
        const second = await request(
          server,
          'POST',
          `/v1/pets/${secondPetId}/weights`,
          options,
        );
        status(first, 201);
        status(second, 201);
        assert.notEqual(first.data.id, second.data.id);
        await db.idempotencyResult.updateMany({
          where: { userId: owner.user.id, scope: `recordWeight:${petId}` },
          data: { expiresAt: new Date(0) },
        });
        const expired = await request(
          server,
          'POST',
          `${petPath}/weights`,
          options,
        );
        status(expired, 201);
        assert.notEqual(first.data.id, expired.data.id);
      },
    );
    let duplicateResults;
    await t.test(
      'duplicate-write probe reaches the API and confirms the resulting database rows',
      async () => {
        const options = {
          token: owner.token,
          headers: { 'Idempotency-Key': randomUUID() },
          body: { weightKg: 12, recordedOn: '2026-01-01' },
        };
        duplicateResults = await Promise.all([
          request(server, 'POST', `${petPath}/weights`, options),
          request(server, 'POST', `${petPath}/weights`, options),
        ]);
        duplicateResults.forEach((response) => status(response, 201));
        const ids = [
          ...new Set(duplicateResults.map((response) => response.data.id)),
        ];
        assert.equal(
          await db.weightEntry.count({ where: { petId, id: { in: ids } } }),
          ids.length,
        );
      },
    );
    await t.test('duplicate write replays the original result', async () => {
      assert.equal(
        duplicateResults[0].data.id,
        duplicateResults[1].data.id,
        'The same operation/key created distinct weight entries',
      );
    });
    let privilegedLogin;
    await t.test(
      'privileged-login probe reaches real password verification',
      async () => {
        privilegedLogin = await request(server, 'POST', '/v1/auth/login', {
          body: { email: admin.user.email, password },
        });
        status(privilegedLogin, 200);
        assert.ok(
          privilegedLogin.data.accessToken || privilegedLogin.data.mfaRequired,
          'Expected an authenticated session or explicit MFA challenge',
        );
        if (privilegedLogin.data.accessToken)
          assert.equal(privilegedLogin.data.user.role, 'admin');
      },
    );
    await t.test(
      'KNOWN GAP: privileged password login must require a second factor',
      {
        todo: strict
          ? undefined
          : 'MFA is not implemented; admin password login currently returns a full session',
      },
      async () => {
        assert.ok(
          !privilegedLogin.data.accessToken,
          'Password alone yielded a privileged access token',
        );
      },
    );
    await t.test(
      'withdrawing verification blocks new codes but retains existing consent by current policy',
      async () => {
        status(
          await request(
            server,
            'POST',
            `/v1/admin/clinics/${clinic.user.clinicId}/unverify`,
            { token: admin.token },
          ),
          200,
        );
        status(
          await request(server, 'POST', '/v1/clinics/mine/link-codes', {
            token: clinic.token,
          }),
          403,
        );
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          200,
        );
      },
    );

    await t.test(
      'refresh rotates the cookie; replay revokes the successor and its access token',
      async () => {
        const refreshed = await request(server, 'POST', '/v1/auth/refresh', {
          cookie: owner.cookie,
        });
        status(refreshed, 200);
        assert.ok(refreshed.cookie && refreshed.cookie !== owner.cookie);
        status(
          await request(server, 'GET', '/v1/auth/me', { token: owner.token }),
          401,
        );
        status(
          await request(server, 'GET', '/v1/auth/me', {
            token: refreshed.data.accessToken,
          }),
          200,
        );
        status(
          await request(server, 'POST', '/v1/auth/refresh', {
            cookie: owner.cookie,
          }),
          401,
        );
        status(
          await request(server, 'GET', '/v1/auth/me', {
            token: refreshed.data.accessToken,
          }),
          401,
        );
        status(
          await request(server, 'POST', '/v1/auth/refresh', {
            cookie: refreshed.cookie,
          }),
          401,
        );
      },
    );
    await t.test(
      'logout immediately invalidates the access token',
      async () => {
        status(
          await request(server, 'POST', '/v1/auth/logout', {
            cookie: other.cookie,
          }),
          204,
        );
        status(
          await request(server, 'GET', '/v1/auth/me', { token: other.token }),
          401,
        );
      },
    );
    await t.test(
      'simultaneous real HTTP refreshes cannot leave an active replay successor',
      async () => {
        const attempts = await Promise.all(
          [0, 1].map(() =>
            request(server, 'POST', '/v1/auth/refresh', {
              cookie: sessions.registered.cookie,
            }),
          ),
        );
        assert.deepEqual(
          attempts.map((response) => response.status).sort((a, b) => a - b),
          [200, 401],
        );
        const winner = attempts.find((response) => response.status === 200);
        status(
          await request(server, 'GET', '/v1/auth/me', {
            token: winner.data.accessToken,
          }),
          401,
        );
      },
    );

    // A new real instance gives this bounded rate-limit probe a clean bucket;
    // it does not replace, disable or mock the production throttler.
    rateServer = await start();
    await t.test(
      'per-account limits block repeated attempts at the real login endpoint',
      async () => {
        for (let i = 0; i < 5; i++)
          status(
            await request(rateServer, 'POST', '/v1/auth/login', {
              body: {
                email: owner.user.email,
                password: 'intentionally-wrong-password',
              },
            }),
            401,
          );
        const response = await request(rateServer, 'POST', '/v1/auth/login', {
          body: { email: owner.user.email, password },
        });
        status(response, 429);
        assert.equal(response.data.code, 'RATE_LIMITED');
      },
    );
  },
);
