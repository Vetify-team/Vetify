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
// Guards, not tests: they abort the run before any database is touched.
if (!databaseUrl) {
  throw new Error(
    'Set SECURITY_TEST_DATABASE_URL to a migrated disposable local vetify_security_* database',
  );
}
const url = new URL(databaseUrl);
if (!(
  ['postgres:', 'postgresql:'].includes(url.protocol) &&
  !url.search &&
  !url.hash &&
  ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
  /^\/vetify_security_[a-z0-9_]+$/.test(url.pathname)
)) {
  throw new Error('E2E tests refuse remote and non-security-test databases');
}
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
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
  VAPID_SUBJECT: '',
  NOTIFICATIONS_WORKER_ENABLED: 'false',
  // Payments on (the pet limit only applies then). No test reaches ONVO.
  ONVO_SECRET_KEY: 'onvo_test_secret_key_e2e_not_real',
  ONVO_WEBHOOK_SECRET: '',
  // Fake credentials: signing is local, and the stand-in below answers every
  // call to Cloudinary's API, so no test reaches the real service.
  CLOUDINARY_URL:
    'cloudinary://000000000000000:e2e-not-a-real-secret@vetify-e2e',
  // Fake key: the stand-in below answers every call to Resend, so no test
  // sends real email (and a key in a local .env is never used).
  RESEND_API_KEY: 're_e2e_not_a_real_key',
});

/**
 * Stand-in for Resend: `sent` records every email the API tried to send;
 * `mode` makes it accept ('ok'), fail with 500 ('fail') or never answer ('hang').
 */
const resend = { sent: [], mode: 'ok' };

/**
 * Stand-in for Cloudinary's Admin API: `files` is what was "uploaded"
 * (public id → { bytes, format }), `deleted` records every delete call.
 */
const cloudinary = { files: new Map(), deleted: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const target = new URL(input instanceof Request ? input.url : String(input));
  if (target.hostname === 'api.resend.com') {
    resend.sent.push(JSON.parse(init.body));
    if (resend.mode === 'hang') return new Promise(() => undefined);
    return resend.mode === 'fail'
      ? new Response('Resend is down', { status: 500 })
      : Response.json({ id: randomUUID() });
  }
  if (target.hostname !== 'api.cloudinary.com') return realFetch(input, init);
  const resources = '/v1_1/vetify-e2e/resources/image/authenticated';
  if (init.method === 'DELETE' && target.pathname === resources) {
    const prefix = target.searchParams.get('prefix');
    const ids = prefix ? [prefix] : target.searchParams.getAll('public_ids[]');
    cloudinary.deleted.push(...ids);
    for (const id of ids) cloudinary.files.delete(id);
    return Response.json({ deleted: {}, partial: false });
  }
  const file = target.pathname.startsWith(`${resources}/`)
    ? cloudinary.files.get(target.pathname.slice(resources.length + 1))
    : undefined;
  return file
    ? Response.json(file)
    : Response.json(
        { error: { message: 'Resource not found' } },
        { status: 404 },
      );
};

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
          // These owners create more pets than the free plan allows.
          ...(role === 'owner'
            ? { plan: 'premium', planUntil: new Date(Date.now() + 86_400_000) }
            : {}),
        },
      });
      userIds.add(user.id);
      if (role === 'clinic') {
        const clinic = await db.clinic.create({
          data: {
            name: `E2E ${name}`,
            staff: { create: { userId: user.id, role: 'admin' } },
          },
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

    await t.test('the free plan caps an owner at two pets', async () => {
      const free = await db.user.create({
        data: {
          email: `${run}-free@e2e.test`,
          name: 'E2E free',
          role: 'owner',
          passwordHash,
        },
      });
      userIds.add(free.id);
      const login = await request(server, 'POST', '/v1/auth/login', {
        body: { email: free.email, password },
      });
      status(login, 200);
      const create = (name) =>
        request(server, 'POST', '/v1/pets', {
          token: login.data.accessToken,
          body: { name, species: 'cat' },
        });
      status(await create('Free one'), 201);
      status(await create('Free two'), 201);
      const third = await create('Free three');
      status(third, 400);
      assert.equal(third.data.reason, 'PLAN_LIMIT');
    });

    await t.test(
      'public card is owner managed, minimal, and revocable',
      async () => {
        const path = `${petPath}/card-link`;
        status(
          await request(server, 'POST', path, { token: other.token }),
          404,
        );
        status(
          await request(server, 'POST', path, { token: clinic.token }),
          403,
        );
        const created = await request(server, 'POST', path, {
          token: owner.token,
        });
        status(created, 201);
        const first = created.data.token;
        const current = await request(server, 'GET', path, {
          token: owner.token,
        });
        status(current, 200);
        assert.equal(current.data.token, first);
        const view = await request(server, 'POST', '/v1/card/verify', {
          body: { token: first },
        });
        status(view, 201);
        assert.deepEqual(Object.keys(view.data).sort(), ['name', 'vaccines']);
        assert.equal(view.data.name, 'Private owner pet');
        for (const vaccine of view.data.vaccines)
          assert.deepEqual(Object.keys(vaccine).sort(), [
            'expiresOn',
            'lastAppliedOn',
            'status',
            'vaccine',
          ]);
        const replaced = await request(server, 'POST', path, {
          token: owner.token,
        });
        status(replaced, 201);
        status(
          await request(server, 'POST', '/v1/card/verify', {
            body: { token: first },
          }),
          404,
        );
        status(
          await request(server, 'DELETE', path, { token: owner.token }),
          200,
        );
        status(
          await request(server, 'POST', '/v1/card/verify', {
            body: { token: replaced.data.token },
          }),
          404,
        );
      },
    );

    await t.test(
      'notification inbox and subscriptions are owner-scoped and deduplicated',
      async () => {
        const { NotificationsService } =
          await import('../dist/notifications/notifications.service.js');
        const worker = server.app.get(NotificationsService);
        const date = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Costa_Rica',
        }).format(new Date());
        const today = new Date(`${date}T00:00:00.000Z`);
        const due = new Date(today.getTime() + 7 * 86400000);
        const pet = await db.pet.create({
          data: {
            ownerId: owner.user.id,
            name: 'Reminder test',
            species: 'dog',
          },
        });
        try {
          await db.deworming.create({
            data: {
              petId: pet.id,
              kind: 'internal',
              appliedOn: today,
              nextDueOn: due,
            },
          });
          const subscription = {
            endpoint: 'https://fcm.googleapis.com/fcm/send/testing',
            keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) },
          };
          status(
            await request(server, 'POST', '/v1/notifications/subscriptions', {
              token: owner.token,
              body: { ...subscription, endpoint: 'https://127.0.0.1/private' },
            }),
            400,
          );
          status(
            await request(server, 'POST', '/v1/notifications/subscriptions', {
              token: owner.token,
              body: subscription,
            }),
            201,
          );
          status(
            await request(server, 'POST', '/v1/notifications/subscriptions', {
              token: other.token,
              body: subscription,
            }),
            400,
          );
          process.env.DEV_PUSH_TEST_ENABLED = 'true';
          try {
            status(
              await request(server, 'POST', '/v1/notifications/test-push', {
                token: owner.token,
                body: { endpoint: subscription.endpoint },
              }),
              404,
            );
            const config = await request(
              server,
              'GET',
              '/v1/notifications/push-config',
              { token: owner.token },
            );
            status(config, 200);
            assert.equal(config.data.testEnabled, false);
          } finally {
            delete process.env.DEV_PUSH_TEST_ENABLED;
          }
          await worker.run();
          await worker.run();
          const inbox = await request(server, 'GET', '/v1/notifications', {
            token: owner.token,
          });
          status(inbox, 200);
          const notices = inbox.data.filter((item) => item.petId === pet.id);
          assert.equal(notices.length, 1);
          assert.equal(notices[0].offsetDays, 7);
          assert.equal(
            await db.pushDelivery.count({
              where: { notificationId: notices[0].id },
            }),
            1,
          );
          status(
            await request(
              server,
              'POST',
              `/v1/notifications/${notices[0].id}/read`,
              { token: other.token },
            ),
            404,
          );
          status(
            await request(
              server,
              'POST',
              `/v1/notifications/${notices[0].id}/read`,
              { token: owner.token },
            ),
            201,
          );
          status(
            await request(server, 'GET', '/v1/notifications', {
              token: clinic.token,
            }),
            403,
          );
          status(
            await request(
              server,
              'POST',
              '/v1/notifications/subscriptions/remove',
              { token: owner.token, body: { endpoint: subscription.endpoint } },
            ),
            201,
          );
          assert.equal(
            await db.pushDelivery.count({
              where: { notificationId: notices[0].id },
            }),
            0,
          );
        } finally {
          await db.pet.delete({ where: { id: pet.id } });
        }
      },
    );

    await t.test(
      'a sudden weight change notifies the owner once; backdated entries do not',
      async () => {
        const pet = await db.pet.create({
          data: {
            ownerId: owner.user.id,
            name: 'Weight test',
            species: 'dog',
            birthDate: new Date('2020-01-01T00:00:00.000Z'),
          },
        });
        const weigh = (body, key = randomUUID()) =>
          request(server, 'POST', `/v1/pets/${pet.id}/weights`, {
            token: owner.token,
            headers: { 'Idempotency-Key': key },
            body,
          });
        const notices = () =>
          db.appNotification.findMany({
            where: { petId: pet.id, kind: 'weight' },
          });
        try {
          status(await weigh({ weightKg: 20, recordedOn: '2026-01-01' }), 201);
          status(
            await weigh({ weightKg: 19.5, recordedOn: '2026-01-15' }),
            201,
          );
          assert.equal((await notices()).length, 0);

          const key = randomUUID();
          status(
            await weigh({ weightKg: 17, recordedOn: '2026-02-01' }, key),
            201,
          );
          status(
            await weigh({ weightKg: 17, recordedOn: '2026-02-01' }, key),
            201,
          );
          const [notice, ...rest] = await notices();
          assert.equal(rest.length, 0);
          assert.equal(notice.userId, owner.user.id);
          assert.equal(notice.subject, 'bajó 2,5 kg (13 %)');
          // The email copy is queued with the notice.
          assert.equal(
            await db.emailDelivery.count({
              where: { notificationId: notice.id, status: 'pending' },
            }),
            1,
          );

          // Older than the latest entry: history, not news.
          status(await weigh({ weightKg: 30, recordedOn: '2026-01-20' }), 201);
          assert.equal((await notices()).length, 1);

          // A later entry on the same day is the current weight, whatever
          // its random id.
          status(
            await weigh({ weightKg: 14.5, recordedOn: '2026-02-01' }),
            201,
          );
          status(
            await weigh({ weightKg: 12.5, recordedOn: '2026-02-01' }),
            201,
          );
          const subjects = (
            await db.appNotification.findMany({
              where: { petId: pet.id, kind: 'weight' },
              orderBy: { createdAt: 'asc' },
            })
          ).map((n) => n.subject);
          assert.deepEqual(subjects, [
            'bajó 2,5 kg (13 %)',
            'bajó 2,5 kg (15 %)',
            'bajó 2 kg (14 %)',
          ]);
        } finally {
          await db.pet.delete({ where: { id: pet.id } });
        }
      },
    );

    await t.test(
      'reminder email preference is per owner and owner-only',
      async () => {
        const read = (token) =>
          request(server, 'GET', '/v1/notifications/email', { token });
        const set = (token, enabled) =>
          request(server, 'POST', '/v1/notifications/email', {
            token,
            body: { enabled },
          });
        try {
          assert.equal((await read(owner.token)).data.enabled, true);
          status(await set(owner.token, false), 201);
          assert.equal((await read(owner.token)).data.enabled, false);
          assert.equal((await read(other.token)).data.enabled, true);
          status(
            await request(server, 'POST', '/v1/notifications/email', {
              token: owner.token,
              body: { enabled: 'no' },
            }),
            400,
          );
          status(await read(clinic.token), 403);
        } finally {
          await db.user.update({
            where: { id: owner.user.id },
            data: { emailReminders: true },
          });
        }
      },
    );

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
    await t.test('cannot register without accepting the terms', async () => {
      for (const acceptTerms of [undefined, false]) {
        const response = await request(server, 'POST', '/v1/auth/register', {
          body: {
            email: `${run}-no-terms@e2e.test`,
            name: 'No terms',
            password,
            ...(acceptTerms === undefined ? {} : { acceptTerms }),
          },
        });
        if (response.data?.user?.id) userIds.add(response.data.user.id);
        status(response, 400);
      }
    });
    await t.test('cannot self-register as admin', async () => {
      const response = await request(server, 'POST', '/v1/auth/register', {
        body: {
          email: `${run}-forged@e2e.test`,
          name: 'Forged admin',
          role: 'admin',
          password,
          acceptTerms: true,
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
            acceptTerms: true,
          },
        });
        if (response.data?.user?.id) userIds.add(response.data.user.id);
        status(response, 201);
        const stored = await db.user.findUniqueOrThrow({
          where: { id: response.data.user.id },
        });
        assert.match(stored.termsVersion ?? '', /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(stored.termsAcceptedAt instanceof Date);
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
    await t.test(
      'registration succeeds when the welcome email fails, and never sends it twice',
      async (t) => {
        t.after(() => {
          resend.mode = 'ok';
        });
        const welcomes = (email) =>
          resend.sent.filter(
            (sent) =>
              sent.to.includes(email) &&
              sent.subject === 'Te damos la bienvenida a Vetify',
          );
        const register = (email) =>
          request(server, 'POST', '/v1/auth/register', {
            body: { email, name: 'E2E welcome', password, acceptTerms: true },
          });

        resend.mode = 'fail';
        const failing = `${run}-welcome-fail@e2e.test`;
        const first = await register(failing);
        if (first.data?.user?.id) userIds.add(first.data.user.id);
        status(first, 201);
        assert.equal(welcomes(failing).length, 1);
        // A retry of the same sign-up is refused and sends nothing more.
        status(await register(failing), 409);
        assert.equal(welcomes(failing).length, 1);

        resend.mode = 'hang';
        const hanging = `${run}-welcome-hang@e2e.test`;
        const started = Date.now();
        const second = await register(hanging);
        if (second.data?.user?.id) userIds.add(second.data.user.id);
        status(second, 201);
        // Resend never answers; the sign-up does not wait for it.
        assert.ok(Date.now() - started < 5_000);
        assert.equal(welcomes(hanging).length, 1);
        status(
          await request(server, 'GET', '/v1/auth/me', {
            token: second.data.accessToken,
          }),
          200,
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
      'file uploads are signed only for accessible pets, typed, size-limited and private',
      async () => {
        const MB = 1024 * 1024;
        const sign = (token, pet, purpose, contentType, size) =>
          request(server, 'POST', `/v1/pets/${pet}/uploads`, {
            token,
            body: { purpose, contentType, size },
          });
        // Simulates the browser's direct upload of a signed file.
        const upload = async (token, pet, purpose, contentType, stored) => {
          const ticket = await sign(token, pet, purpose, contentType, 1000);
          status(ticket, 201);
          cloudinary.files.set(ticket.data.fileId, stored);
          return ticket.data.fileId;
        };

        // Nobody signs for a pet they cannot write to.
        status(
          await sign(other.token, petId, 'pet_photo', 'image/png', 1000),
          404,
        );
        status(
          await sign(other.token, petId, 'exam_file', 'application/pdf', 1000),
          404,
        );
        status(
          await sign(clinic.token, petId, 'pet_photo', 'image/png', 1000),
          403,
        );
        status(
          await sign(
            secondClinic.token,
            petId,
            'exam_file',
            'application/pdf',
            1000,
          ),
          403,
        );
        status(
          await sign(admin.token, petId, 'exam_file', 'application/pdf', 1000),
          403,
        );
        status(
          await request(server, 'POST', `${petPath}/uploads`, {
            body: { purpose: 'pet_photo', contentType: 'image/png', size: 1 },
          }),
          401,
        );

        // A signature binds one new file under the pet, with formats, no overwrite.
        const ticket = await sign(
          owner.token,
          petId,
          'pet_photo',
          'image/png',
          1000,
        );
        status(ticket, 201);
        assert.equal(
          ticket.data.url,
          'https://api.cloudinary.com/v1_1/vetify-e2e/image/upload',
        );
        assert.match(
          ticket.data.fileId,
          new RegExp(`^pets/${petId}/photo/[0-9a-f-]{36}$`),
        );
        assert.deepEqual(Object.keys(ticket.data.fields).sort(), [
          'allowed_formats',
          'api_key',
          'overwrite',
          'public_id',
          'signature',
          'timestamp',
          'type',
        ]);
        assert.equal(ticket.data.fields.public_id, ticket.data.fileId);
        assert.equal(ticket.data.fields.type, 'authenticated');
        assert.equal(ticket.data.fields.overwrite, 'false');
        assert.equal(ticket.data.fields.allowed_formats, 'jpg,png,webp,heic');
        assert.ok(
          !JSON.stringify(ticket.data).includes('e2e-not-a-real-secret'),
        );
        const clinicTicket = await sign(
          clinic.token,
          petId,
          'exam_file',
          'application/pdf',
          1000,
        );
        status(clinicTicket, 201);
        assert.equal(
          clinicTicket.data.fields.allowed_formats,
          'pdf,jpg,png,webp,heic',
        );

        // Types and sizes are checked when signing…
        for (const [purpose, contentType, size, reason] of [
          ['pet_photo', 'application/pdf', 1000, 'FILE_TYPE_NOT_ALLOWED'],
          ['pet_photo', 'image/svg+xml', 1000, 'FILE_TYPE_NOT_ALLOWED'],
          ['exam_file', 'text/html', 1000, 'FILE_TYPE_NOT_ALLOWED'],
          ['pet_photo', 'image/png', 5 * MB + 1, 'FILE_TOO_LARGE'],
          ['exam_file', 'application/pdf', 10 * MB + 1, 'FILE_TOO_LARGE'],
        ]) {
          const response = await sign(
            owner.token,
            petId,
            purpose,
            contentType,
            size,
          );
          status(response, 400);
          assert.equal(response.data.reason, reason);
        }
        status(
          await sign(owner.token, petId, 'pet_photo', 'image/png', 0),
          400,
        );
        // Links are no longer accepted: only ids of signed uploads.
        for (const value of [
          'javascript:alert(1)',
          'https://169.254.169.254/latest/meta-data/',
          `pets/${petId}/photo/../../${otherPetId}`,
        ]) {
          status(
            await request(server, 'PATCH', petPath, {
              token: owner.token,
              body: { photo: value },
            }),
            400,
          );
        }
        const linkOnly = await request(server, 'PATCH', petPath, {
          token: owner.token,
          body: { photoUrl: 'https://example.com/tracker.png' },
        });
        status(linkOnly, 200);
        assert.equal(linkOnly.data.photoUrl, null);
        status(await sign(owner.token, petId, 'avatar', 'image/png', 1), 400);

        // …and again on the stored file, which is deleted when it breaks them.
        const big = await upload(owner.token, petId, 'pet_photo', 'image/png', {
          bytes: 5 * MB + 1,
          format: 'png',
        });
        const tooBig = await request(server, 'PATCH', petPath, {
          token: owner.token,
          body: { photo: big },
        });
        status(tooBig, 400);
        assert.equal(tooBig.data.reason, 'FILE_TOO_LARGE');
        assert.ok(cloudinary.deleted.includes(big));
        const pdf = await upload(owner.token, petId, 'pet_photo', 'image/png', {
          bytes: 1000,
          format: 'pdf',
        });
        const wrongType = await request(server, 'PATCH', petPath, {
          token: owner.token,
          body: { photo: pdf },
        });
        status(wrongType, 400);
        assert.equal(wrongType.data.reason, 'FILE_TYPE_NOT_ALLOWED');
        const missing = await request(server, 'PATCH', petPath, {
          token: owner.token,
          body: { photo: `pets/${petId}/photo/${randomUUID()}` },
        });
        status(missing, 400);
        assert.equal(missing.data.reason, 'FILE_NOT_UPLOADED');

        // A file signed for one pet cannot be saved to another, or as another purpose.
        const photo = await upload(
          owner.token,
          petId,
          'pet_photo',
          'image/jpeg',
          {
            bytes: 1000,
            format: 'jpg',
          },
        );
        const stolen = await request(
          server,
          'PATCH',
          `/v1/pets/${otherPetId}`,
          {
            token: other.token,
            body: { photo },
          },
        );
        status(stolen, 400);
        assert.equal(stolen.data.reason, 'FILE_NOT_UPLOADED');
        const asExam = await request(server, 'POST', `${petPath}/exams`, {
          token: owner.token,
          body: { performedOn: '2026-01-01', file: photo },
        });
        status(asExam, 400);
        assert.equal(asExam.data.reason, 'FILE_NOT_UPLOADED');

        // The owner saves a photo; replacing it deletes the old file.
        const saved = await request(server, 'PATCH', petPath, {
          token: owner.token,
          body: { photo },
        });
        status(saved, 200);
        assert.match(
          saved.data.photoUrl,
          /^https:\/\/res\.cloudinary\.com\/vetify-e2e\/image\/authenticated\/s--[\w-]{8}--\//,
        );
        const next = await upload(
          owner.token,
          petId,
          'pet_photo',
          'image/webp',
          {
            bytes: 2000,
            format: 'webp',
          },
        );
        status(
          await request(server, 'PATCH', petPath, {
            token: owner.token,
            body: { photo: next },
          }),
          200,
        );
        assert.ok(cloudinary.deleted.includes(photo));

        // Owner and clinic add exams with files; each file serves one exam.
        const ownerFile = await upload(
          owner.token,
          petId,
          'exam_file',
          'application/pdf',
          {
            bytes: 9 * MB,
            format: 'pdf',
          },
        );
        const ownerExam = await request(server, 'POST', `${petPath}/exams`, {
          token: owner.token,
          body: {
            performedOn: '2026-01-01',
            kind: 'Hemograma',
            file: ownerFile,
          },
        });
        status(ownerExam, 201);
        assert.equal(ownerExam.data.fileFormat, 'pdf');
        assert.equal(ownerExam.data.recordedByOwner, true);
        status(
          await request(server, 'POST', `${petPath}/exams`, {
            token: owner.token,
            body: { performedOn: '2026-01-02', file: ownerFile },
          }),
          400,
        );
        const clinicFile = await upload(
          clinic.token,
          petId,
          'exam_file',
          'image/png',
          {
            bytes: 1000,
            format: 'png',
          },
        );
        const clinicExam = await request(server, 'POST', `${petPath}/exams`, {
          token: clinic.token,
          body: { performedOn: '2026-01-01', file: clinicFile },
        });
        status(clinicExam, 201);
        assert.equal(clinicExam.data.recordedByOwner, false);
        status(
          await request(server, 'POST', `${petPath}/exams`, {
            token: secondClinic.token,
            body: { performedOn: '2026-01-01' },
          }),
          403,
        );

        // Reading needs read access to the pet, and the link expires in minutes.
        const filePath = `${petPath}/exams/${ownerExam.data.id}/file`;
        for (const token of [owner.token, clinic.token]) {
          const link = await request(server, 'GET', filePath, { token });
          status(link, 200);
          const url = new URL(link.data.url);
          assert.equal(url.origin, 'https://api.cloudinary.com');
          assert.equal(url.searchParams.get('public_id'), ownerFile);
          const ttl =
            Number(url.searchParams.get('expires_at')) - Date.now() / 1000;
          assert.ok(ttl > 0 && ttl <= 300, `link lives ${ttl}s`);
        }
        status(
          await request(server, 'GET', filePath, { token: other.token }),
          404,
        );
        status(
          await request(server, 'GET', filePath, { token: secondClinic.token }),
          403,
        );
        status(
          await request(server, 'GET', filePath, { token: admin.token }),
          403,
        );
        status(
          await request(
            server,
            'GET',
            `/v1/pets/${otherPetId}/exams/${ownerExam.data.id}/file`,
            { token: other.token },
          ),
          404,
        );
        status(
          await request(
            server,
            'GET',
            `${petPath}/exams/${randomUUID()}/file`,
            {
              token: owner.token,
            },
          ),
          404,
        );
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
      'emergency suspension cuts reads, writes, sessions and linking at once; reinstating restores consent',
      async () => {
        // Its own instance: the login probes get a clean throttler bucket.
        const suspendServer = await start();
        t.after(() => suspendServer.app.close());
        const clinicId = clinic.user.clinicId;
        const suspendPath = `/v1/admin/clinics/${clinicId}/suspend`;
        const reason = 'E2E emergency';
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          200,
        );
        // Only an admin can suspend, and the reason is validated.
        for (const caller of [clinic, secondClinic, owner])
          status(
            await request(server, 'POST', suspendPath, {
              token: caller.token,
              body: { reason },
            }),
            403,
          );
        status(
          await request(server, 'POST', suspendPath, {
            token: admin.token,
            body: { reason: ' ' },
          }),
          400,
        );

        const suspended = await request(server, 'POST', suspendPath, {
          token: admin.token,
          body: { reason },
        });
        status(suspended, 200);
        assert.ok(suspended.data.suspendedAt);
        status(
          await request(server, 'POST', suspendPath, {
            token: admin.token,
            body: { reason },
          }),
          400,
        );
        const audit = await db.clinicSuspension.findMany({
          where: { clinicId },
        });
        assert.equal(audit.length, 1);
        assert.equal(audit[0].suspendedById, admin.user.id);
        assert.equal(audit[0].reason, reason);
        assert.equal(audit[0].liftedAt, null);

        // The live access token, the cookie and the password stop working.
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          401,
        );
        status(
          await request(server, 'POST', `${petPath}/consultations`, {
            token: clinic.token,
            body: { reason: 'Written while suspended' },
          }),
          401,
        );
        status(
          await request(server, 'POST', '/v1/auth/refresh', {
            cookie: clinic.cookie,
          }),
          401,
        );
        const blocked = await request(suspendServer, 'POST', '/v1/auth/login', {
          body: { email: clinic.user.email, password },
        });
        status(blocked, 403);
        assert.equal(blocked.data.code, 'CLINIC_SUSPENDED');
        // A wrong password does not reveal the suspension.
        status(
          await request(suspendServer, 'POST', '/v1/auth/login', {
            body: { email: clinic.user.email, password: 'wrong-password-x' },
          }),
          401,
        );
        // Even a session that slipped through grants nothing: the
        // permission of a suspended clinic does not count.
        const permission = await db.permission.findFirst({
          where: { petId, clinicId },
        });
        assert.equal(permission.status, 'active');
        const visible = await db.pet.count({
          where: {
            id: petId,
            permissions: {
              some: {
                status: 'active',
                clinic: { suspendedAt: null, id: clinicId },
              },
            },
          },
        });
        assert.equal(visible, 0);

        // Other clinics are untouched; the owner sees the suspension.
        status(
          await request(server, 'GET', '/v1/clinics/mine', {
            token: secondClinic.token,
          }),
          200,
        );
        const permissions = await request(
          server,
          'GET',
          `${petPath}/permissions`,
          { token: owner.token },
        );
        status(permissions, 200);
        const listed = permissions.data.find((p) => p.clinicId === clinicId);
        assert.ok(listed.clinic.suspendedAt);
        assert.equal(
          permissions.data.find(
            (p) => p.clinicId === secondClinic.user.clinicId,
          ).clinic.suspendedAt,
          null,
        );

        // Reinstating restores the same permission, and closes the audit.
        for (const caller of [clinic, owner])
          status(
            await request(
              server,
              'POST',
              `/v1/admin/clinics/${clinicId}/reinstate`,
              { token: caller.token },
            ),
            caller === clinic ? 401 : 403,
          );
        const reinstated = await request(
          server,
          'POST',
          `/v1/admin/clinics/${clinicId}/reinstate`,
          { token: admin.token },
        );
        status(reinstated, 200);
        assert.equal(reinstated.data.suspendedAt, null);
        const closed = await db.clinicSuspension.findFirst({
          where: { clinicId },
        });
        assert.equal(closed.liftedById, admin.user.id);
        assert.ok(closed.liftedAt);
        const login = await request(suspendServer, 'POST', '/v1/auth/login', {
          body: { email: clinic.user.email, password },
        });
        status(login, 200);
        clinic.token = login.data.accessToken;
        clinic.cookie = login.cookie;
        clinic.login = login;
        status(
          await request(server, 'GET', `${petPath}/record`, {
            token: clinic.token,
          }),
          200,
        );
      },
    );

    await t.test(
      'team invitations are single use and expire; signatures and removal follow the member',
      async () => {
        // Its own instance: account creation and log-ins get a clean bucket.
        const teamServer = await start();
        t.after(() => teamServer.app.close());
        const call = (method, path, options) =>
          request(teamServer, method, path, options);
        const invite = async (email, role = 'veterinarian') => {
          const before = resend.sent.length;
          const response = await call('POST', '/v1/clinics/mine/invitations', {
            token: clinic.token,
            body: { email, role },
          });
          status(response, 201);
          const sent = resend.sent.slice(before).find((e) => e.to[0] === email);
          const link = /\/invitacion#([\w-]+)/.exec(sent.text);
          assert.ok(sent.text.startsWith('Hola'));
          assert.ok(sent.text.includes(`${origin}/invitacion#`));
          return { id: response.data.id, token: link[1] };
        };
        const accept = (token, name = 'E2E vet') =>
          call('POST', '/v1/auth/clinic-invitations/accept', {
            body: { token, name, password, acceptTerms: true },
          });
        const vetEmail = `${run}-vet@e2e.test`;

        // Only administrators of the clinic manage its team.
        const memberId = randomUUID();
        const vetOnly = await db.user.create({
          data: {
            email: `${run}-plainvet@e2e.test`,
            name: 'E2E plain vet',
            role: 'clinic',
            passwordHash,
            clinicStaff: {
              create: { clinicId: clinic.user.clinicId, role: 'veterinarian' },
            },
          },
        });
        userIds.add(vetOnly.id);
        const plain = await call('POST', '/v1/auth/login', {
          body: { email: vetOnly.email, password },
        });
        status(plain, 200);
        for (const [method, path] of [
          ['GET', '/v1/clinics/mine/staff'],
          ['GET', '/v1/clinics/mine/invitations'],
          ['POST', '/v1/clinics/mine/invitations'],
          ['POST', `/v1/clinics/mine/staff/${clinic.user.id}/remove`],
        ])
          status(
            await call(method, path, {
              token: plain.data.accessToken,
              body:
                method === 'POST' ? { email: `${run}-x@e2e.test` } : undefined,
            }),
            403,
          );
        for (const caller of [owner, admin])
          status(
            await call('GET', '/v1/clinics/mine/staff', {
              token: caller.token,
            }),
            403,
          );
        // The invitation link must point to an allowed site.
        status(
          await call('POST', '/v1/clinics/mine/invitations', {
            token: clinic.token,
            body: { email: vetEmail },
            browserOrigin: 'https://evil.example',
          }),
          403,
        );
        // An email with an account cannot be invited.
        const taken = await call('POST', '/v1/clinics/mine/invitations', {
          token: clinic.token,
          body: { email: owner.user.email },
        });
        status(taken, 409);
        assert.equal(taken.data.code, 'EMAIL_TAKEN');

        const invitation = await invite(vetEmail);
        const stored = await db.clinicInvitation.findUnique({
          where: { id: invitation.id },
        });
        assert.ok(!JSON.stringify(stored).includes(invitation.token));

        // Another clinic cannot see or withdraw it.
        status(
          await call(
            'POST',
            `/v1/clinics/mine/invitations/${invitation.id}/revoke`,
            { token: secondClinic.token },
          ),
          404,
        );
        const othersTeam = await call('GET', '/v1/clinics/mine/staff', {
          token: secondClinic.token,
        });
        status(othersTeam, 200);
        assert.deepEqual(
          othersTeam.data.map((m) => m.userId),
          [secondClinic.user.id],
        );

        const preview = await call('POST', '/v1/clinic-invitations/preview', {
          body: { token: invitation.token },
        });
        status(preview, 200);
        assert.equal(preview.data.email, vetEmail);
        assert.equal(preview.data.role, 'veterinarian');

        const joined = await accept(invitation.token);
        status(joined, 201);
        assert.equal(joined.data.user.email, vetEmail);
        assert.equal(joined.data.user.role, 'clinic');
        const vet = { token: joined.data.accessToken, id: joined.data.user.id };
        userIds.add(vet.id);
        const reused = await accept(invitation.token, 'Someone else');
        status(reused, 400);
        assert.equal(reused.data.code, 'INVITATION_INVALID');
        status(
          await call('POST', '/v1/clinic-invitations/preview', {
            body: { token: invitation.token },
          }),
          400,
        );

        // Expired and withdrawn links create nothing.
        const expired = await invite(`${run}-late@e2e.test`);
        await db.clinicInvitation.update({
          where: { id: expired.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        status(await accept(expired.token), 400);
        const withdrawn = await invite(`${run}-withdrawn@e2e.test`);
        status(
          await call(
            'POST',
            `/v1/clinics/mine/invitations/${withdrawn.id}/revoke`,
            { token: clinic.token },
          ),
          204,
        );
        status(await accept(withdrawn.token), 400);
        assert.equal(
          await db.user.count({
            where: {
              email: {
                in: [`${run}-late@e2e.test`, `${run}-withdrawn@e2e.test`],
              },
            },
          }),
          0,
        );

        // The new member works on the clinic's patients and signs as themself.
        status(
          await call('GET', `${petPath}/record`, { token: vet.token }),
          200,
        );
        const signed = {};
        for (const [section, body] of [
          [
            'consultations',
            { reason: 'Signed', veterinarianId: clinic.user.id },
          ],
          ['vaccinations', { vaccine: 'Rabia', appliedOn: '2026-01-02' }],
          ['dewormings', { appliedOn: '2026-01-02', clinicId: memberId }],
          ['treatments', { description: 'Signed treatment' }],
          ['exams', { performedOn: '2026-01-02', kind: 'Signed exam' }],
        ]) {
          const response = await call('POST', `${petPath}/${section}`, {
            token: vet.token,
            body,
          });
          status(response, 201);
          assert.equal(response.data.veterinarianId, vet.id, section);
          assert.equal(response.data.clinicId, clinic.user.clinicId, section);
          signed[section] = response.data.id;
        }
        const record = await call('GET', `${petPath}/record`, {
          token: owner.token,
        });
        status(record, 200);
        assert.ok(
          record.data.veterinarians.some(
            (v) => v.id === vet.id && v.name === 'E2E vet',
          ),
        );
        // It reaches only the patients its clinic was given.
        status(
          await call('GET', `/v1/pets/${otherPetId}/record`, {
            token: vet.token,
          }),
          403,
        );

        // Removing them cuts access at once: token, cookie and log-in.
        status(
          await call('POST', `/v1/clinics/mine/staff/${vet.id}/remove`, {
            token: secondClinic.token,
          }),
          404,
        );
        status(
          await call('POST', `/v1/clinics/mine/staff/${vet.id}/remove`, {
            token: clinic.token,
          }),
          204,
        );
        status(
          await call('GET', `${petPath}/record`, { token: vet.token }),
          401,
        );
        status(
          await call('POST', '/v1/auth/refresh', { cookie: joined.cookie }),
          401,
        );
        const formerLogin = await call('POST', '/v1/auth/login', {
          body: { email: vetEmail, password },
        });
        status(formerLogin, 403);
        assert.equal(formerLogin.data.code, 'NOT_CLINIC_MEMBER');
        // What they signed stays signed.
        const kept = await db.vaccination.findUnique({
          where: { id: signed.vaccinations },
        });
        assert.equal(kept.veterinarianId, vet.id);

        // The last administrator stays.
        const lastAdmin = await call(
          'POST',
          `/v1/clinics/mine/staff/${clinic.user.id}/remove`,
          { token: clinic.token },
        );
        status(lastAdmin, 400);
        await db.clinicStaff.deleteMany({ where: { userId: vetOnly.id } });
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

    await t.test(
      'password reset: same answer for any email, single-use link, sessions revoked',
      async () => {
        // Its own instance: the shared one has spent its login budget.
        const resetServer = await start();
        t.after(() => resetServer.app.close());
        const { createHash } = await import('node:crypto');
        const hash = (value) =>
          createHash('sha256').update(value).digest('hex');
        const user = await db.user.create({
          data: {
            email: `${run}-reset@e2e.test`,
            name: 'E2E reset',
            role: 'owner',
            passwordHash,
          },
        });
        userIds.add(user.id);
        const login = await request(resetServer, 'POST', '/v1/auth/login', {
          body: { email: user.email, password },
        });
        status(login, 200);

        // Unknown and known emails get the same 202; only the known one
        // gets a link row (written after the response).
        for (const email of [`${run}-nobody@e2e.test`, user.email])
          status(
            await request(resetServer, 'POST', '/v1/auth/password/forgot', {
              body: { email },
            }),
            202,
          );
        for (let i = 0; i < 50; i++) {
          if (await db.passwordReset.count({ where: { userId: user.id } }))
            break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        assert.equal(
          await db.passwordReset.count({ where: { userId: user.id } }),
          1,
        );

        const token = randomBytes(32).toString('base64url');
        await db.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash: hash(token),
            expiresAt: new Date(Date.now() + 600_000),
          },
        });
        const expired = randomBytes(32).toString('base64url');
        await db.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash: hash(expired),
            expiresAt: new Date(Date.now() - 1_000),
          },
        });
        const newPassword = randomBytes(24).toString('base64');

        const rejected = await request(
          resetServer,
          'POST',
          '/v1/auth/password/reset',
          {
            body: { token: expired, password: newPassword },
          },
        );
        status(rejected, 400);
        assert.equal(rejected.data.code, 'RESET_TOKEN_INVALID');
        status(
          await request(resetServer, 'POST', '/v1/auth/password/reset', {
            body: { token, password: 'short' },
          }),
          400,
        );

        status(
          await request(resetServer, 'POST', '/v1/auth/password/reset', {
            body: { token, password: newPassword },
          }),
          204,
        );
        // Single use, and the old session is gone everywhere.
        status(
          await request(resetServer, 'POST', '/v1/auth/password/reset', {
            body: { token, password: randomBytes(24).toString('base64') },
          }),
          400,
        );
        status(
          await request(resetServer, 'GET', '/v1/auth/me', {
            token: login.data.accessToken,
          }),
          401,
        );
        status(
          await request(resetServer, 'POST', '/v1/auth/refresh', {
            cookie: login.cookie,
          }),
          401,
        );
        status(
          await request(resetServer, 'POST', '/v1/auth/login', {
            body: { email: user.email, password },
          }),
          401,
        );
        status(
          await request(resetServer, 'POST', '/v1/auth/login', {
            body: { email: user.email, password: newPassword },
          }),
          200,
        );
        assert.equal(
          await db.passwordReset.count({
            where: { userId: user.id, usedAt: null },
          }),
          0,
        );
      },
    );

    await t.test(
      "closing an account erases all of that owner's data and nothing else",
      async () => {
        // Its own instance: the shared one has spent its login budget.
        const closeServer = await start();
        t.after(() => closeServer.app.close());
        const day = new Date('2026-11-01T00:00:00.000Z');
        const hex = (value) => value.replace(/-/g, '').padEnd(64, '0');

        // Everything an owner can have, in every table that holds it.
        const seed = async (name) => {
          const user = await db.user.create({
            data: {
              email: `${run}-${name}@e2e.test`,
              name: `E2E ${name}`,
              role: 'owner',
              passwordHash,
            },
          });
          userIds.add(user.id);
          const login = await request(closeServer, 'POST', '/v1/auth/login', {
            body: { email: user.email, password },
          });
          status(login, 200);
          const pet = await db.pet.create({
            data: { ownerId: user.id, name: `${name} pet`, species: 'dog' },
          });
          const consultation = await db.consultation.create({
            data: {
              petId: pet.id,
              clinicId: clinic.user.clinicId,
              reason: 'x',
            },
          });
          await db.treatment.create({
            data: {
              petId: pet.id,
              consultationId: consultation.id,
              description: 'x',
            },
          });
          await db.vaccination.create({
            data: { petId: pet.id, vaccine: 'Rabia', appliedOn: day },
          });
          await db.deworming.create({
            data: { petId: pet.id, kind: 'internal', appliedOn: day },
          });
          await db.exam.create({
            data: {
              petId: pet.id,
              performedOn: day,
              fileId: `pets/${pet.id}/exams/${randomUUID()}`,
              fileFormat: 'pdf',
            },
          });
          await db.weightEntry.create({
            data: { petId: pet.id, recordedOn: day, weightKg: '12.5' },
          });
          await db.feedingEntry.create({
            data: { petId: pet.id, recordedOn: day, notes: 'x' },
          });
          await db.permission.create({
            data: { petId: pet.id, clinicId: clinic.user.clinicId },
          });
          await db.cardLink.create({
            data: { petId: pet.id, nonce: randomUUID() },
          });
          await db.reminder.create({
            data: { petId: pet.id, kind: 'vaccination', dueOn: day },
          });
          await db.anomaly.create({ data: { petId: pet.id, kind: 'weight' } });
          await db.accessLog.create({
            data: { petId: pet.id, userId: clinic.user.id, action: 'read' },
          });
          const notice = await db.appNotification.create({
            data: {
              userId: user.id,
              petId: pet.id,
              eventKey: `${run}-${name}-notice`,
              kind: 'vaccination',
              subject: 'Rabia',
              dueOn: day,
              offsetDays: 7,
            },
          });
          const subscription = await db.pushSubscription.create({
            data: {
              userId: user.id,
              endpoint: `https://fcm.googleapis.com/fcm/send/${run}-${name}`,
              p256dh: 'A'.repeat(87),
              auth: 'A'.repeat(22),
            },
          });
          await db.pushDelivery.create({
            data: {
              notificationId: notice.id,
              subscriptionId: subscription.id,
            },
          });
          await db.emailDelivery.create({
            data: { notificationId: notice.id },
          });
          await db.payment.create({
            data: {
              userId: user.id,
              plan: 'premium',
              amount: '1000',
              orderNumber: `${run}-${name}-order`,
            },
          });
          await db.passwordReset.create({
            data: {
              userId: user.id,
              tokenHash: hex(randomUUID()),
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
          await db.idempotencyResult.create({
            data: {
              userId: user.id,
              scope: 'e2e',
              keyHash: hex(randomUUID()),
              fingerprint: hex(randomUUID()),
              response: {},
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
          return { user, login, petId: pet.id, noticeId: notice.id };
        };
        const counts = async ({ user, petId, noticeId }) => {
          const byPet = { where: { petId } };
          const byUser = { where: { userId: user.id } };
          return {
            users: await db.user.count({ where: { id: user.id } }),
            pets: await db.pet.count({ where: { id: petId } }),
            consultations: await db.consultation.count(byPet),
            treatments: await db.treatment.count(byPet),
            vaccinations: await db.vaccination.count(byPet),
            dewormings: await db.deworming.count(byPet),
            exams: await db.exam.count(byPet),
            weights: await db.weightEntry.count(byPet),
            feedings: await db.feedingEntry.count(byPet),
            permissions: await db.permission.count(byPet),
            cardLinks: await db.cardLink.count(byPet),
            reminders: await db.reminder.count(byPet),
            anomalies: await db.anomaly.count(byPet),
            accessLogs: await db.accessLog.count(byPet),
            notices: await db.appNotification.count(byUser),
            pushSubscriptions: await db.pushSubscription.count(byUser),
            pushDeliveries: await db.pushDelivery.count({
              where: { notificationId: noticeId },
            }),
            emailDeliveries: await db.emailDelivery.count({
              where: { notificationId: noticeId },
            }),
            payments: await db.payment.count(byUser),
            passwordResets: await db.passwordReset.count(byUser),
            idempotencyResults: await db.idempotencyResult.count(byUser),
            sessions: await db.refreshSession.count(byUser),
          };
        };
        const everything = (value) =>
          Object.fromEntries(
            Object.keys(value).map((key) => [key, key === 'sessions' ? 2 : 1]),
          );

        const closing = await seed('closing');
        const bystander = await seed('bystander');
        // Login + the seed's own login: two sessions each.
        await request(closeServer, 'POST', '/v1/auth/login', {
          body: { email: closing.user.email, password },
        });
        await request(closeServer, 'POST', '/v1/auth/login', {
          body: { email: bystander.user.email, password },
        });
        const before = await counts(closing);
        assert.deepEqual(before, everything(before));

        // A clinic cannot use it, not even on itself.
        const asClinic = await request(
          closeServer,
          'POST',
          '/v1/auth/account/delete',
          { token: clinic.token, body: { password } },
        );
        status(asClinic, 403);
        assert.equal(asClinic.data.code, 'FORBIDDEN');
        assert.equal(await db.user.count({ where: { id: clinic.user.id } }), 1);

        // Identity first: a wrong password or no password changes nothing.
        const wrong = await request(
          closeServer,
          'POST',
          '/v1/auth/account/delete',
          { token: closing.login.data.accessToken, body: { password: 'nope' } },
        );
        status(wrong, 403);
        assert.equal(wrong.data.code, 'WRONG_PASSWORD');
        status(
          await request(closeServer, 'POST', '/v1/auth/account/delete', {
            token: closing.login.data.accessToken,
            body: {},
          }),
          400,
        );
        assert.deepEqual(await counts(closing), before);

        const closed = await request(
          closeServer,
          'POST',
          '/v1/auth/account/delete',
          {
            token: closing.login.data.accessToken,
            cookie: closing.login.cookie,
            body: { password },
          },
        );
        status(closed, 204);
        assert.match(
          closed.headers.get('set-cookie') ?? '',
          /vetify_refresh=;|Expires=Thu, 01 Jan 1970/,
        );
        assert.deepEqual(
          await counts(closing),
          Object.fromEntries(Object.keys(before).map((key) => [key, 0])),
        );
        // Its uploaded files are deleted from storage after the commit.
        for (
          let i = 0;
          i < 50 && !cloudinary.deleted.includes(`pets/${closing.petId}/`);
          i++
        )
          await new Promise((resolve) => setTimeout(resolve, 20));
        assert.ok(cloudinary.deleted.includes(`pets/${closing.petId}/`));
        assert.ok(!cloudinary.deleted.includes(`pets/${bystander.petId}/`));
        // The other owner and the clinic keep everything.
        const kept = await counts(bystander);
        assert.deepEqual(kept, everything(kept));
        assert.equal(await db.user.count({ where: { id: clinic.user.id } }), 1);
        assert.equal(
          await db.clinic.count({ where: { id: clinic.user.clinicId } }),
          1,
        );

        // The old token, the old cookie and the password are all dead.
        status(
          await request(closeServer, 'GET', '/v1/auth/me', {
            token: closing.login.data.accessToken,
          }),
          401,
        );
        status(
          await request(closeServer, 'POST', '/v1/auth/refresh', {
            cookie: closing.login.cookie,
          }),
          401,
        );
        status(
          await request(closeServer, 'POST', '/v1/auth/login', {
            body: { email: closing.user.email, password },
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
