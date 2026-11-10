import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PAID_PLANS, PLAN_PERIOD_DAYS, type TokenPayload } from '@vetify/types';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { BillingService } from '../src/billing/billing.service.js';
import {
  OnvoClient,
  type OnvoCheckoutSession,
  type OnvoPaymentIntent,
} from '../src/billing/onvo.client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { Env } from '../src/config.js';

// Same rule as the other integration suite: never the app's own database.
const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const ORIGIN = 'https://app.vetify.example';
const DAY = 24 * 60 * 60 * 1000;
const KEY = 'onvo_test_secret_key_integration';

let settings: Record<string, unknown> = {};
const config = {
  get: (key: string) => settings[key],
} as unknown as ConfigService<Env, true>;

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown>;
  authorization?: string;
}
interface Reply {
  status: number;
  body: unknown;
}

/** What the ONVO double knows: sessions by id and intents by id. */
let sessions: Map<string, OnvoCheckoutSession>;
let intents: Map<string, OnvoPaymentIntent>;
let calls: Call[];
let override: ((call: Call) => Reply | undefined) | undefined;

/** Stands in for api.onvopay.com and records what the client sent. */
const onvoDouble = vi.fn(
  async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      body:
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : {},
      authorization: headers.Authorization,
    };
    calls.push(call);
    const reply = override?.(call) ?? route(call);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
);

function route(call: Call): Reply {
  if (
    call.method === 'POST' &&
    call.path === '/v1/checkout/sessions/one-time-link'
  ) {
    const id = `cs_${randomUUID()}`;
    const [item] = call.body.lineItems as {
      unitAmount: number;
      currency: string;
    }[];
    sessions.set(id, {
      id,
      url: `https://checkout.onvopay.com/${id}`,
      status: 'open',
      paymentStatus: 'unpaid',
      mode: 'test',
      amountTotal: item.unitAmount,
      currency: item.currency,
      metadata: call.body.metadata as Record<string, unknown>,
      paymentIntentId: null,
    });
    return { status: 201, body: sessions.get(id) };
  }
  const session = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(call.path);
  if (session) {
    const found = sessions.get(session[1]);
    return found
      ? { status: 200, body: found }
      : { status: 404, body: { statusCode: 404, message: 'Not found' } };
  }
  const intent = /^\/v1\/payment-intents\/([^/]+)$/.exec(call.path);
  if (intent) {
    const found = intents.get(intent[1]);
    return found
      ? { status: 200, body: found }
      : { status: 404, body: { statusCode: 404, message: 'Not found' } };
  }
  return { status: 404, body: {} };
}

/** The buyer pays: the session completes and its intent succeeds. */
function pay(
  sessionId: string,
  over: Partial<OnvoPaymentIntent> = {},
  sessionOver: Partial<OnvoCheckoutSession> = {},
) {
  const session = sessions.get(sessionId)!;
  const intentId = `pi_${randomUUID()}`;
  intents.set(intentId, {
    id: intentId,
    status: 'succeeded',
    amount: session.amountTotal,
    currency: session.currency,
    mode: 'test',
    ...over,
  });
  sessions.set(sessionId, {
    ...session,
    status: 'complete',
    paymentStatus: 'paid',
    paymentIntentId: intentId,
    ...sessionOver,
  });
  return intentId;
}

describe.skipIf(!databaseUrl)('ONVO payments', () => {
  let db: PrismaClient;
  let prisma: PrismaService;
  let billing: BillingService;
  const users: string[] = [];
  const clinicIds: string[] = [];

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/vetify_security_[a-z0-9_]+$/.test(url.pathname)
    ) {
      throw new Error(
        'Billing integration tests require a local vetify_security_* database',
      );
    }
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl! }),
    });
    await db.$connect();
    prisma = db as unknown as PrismaService;
  });

  afterAll(async () => {
    if (db) {
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.clinic.deleteMany({ where: { id: { in: clinicIds } } });
      await db.$disconnect();
    }
  });

  beforeEach(() => {
    settings = { ONVO_SECRET_KEY: KEY, ALLOWED_ORIGINS: [ORIGIN] };
    sessions = new Map();
    intents = new Map();
    calls = [];
    override = undefined;
    vi.stubGlobal('fetch', onvoDouble);
    billing = new BillingService(prisma, new OnvoClient(config), config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onvoDouble.mockClear();
  });

  const owner = async () => {
    const user = await db.user.create({
      data: {
        email: `billing-${randomUUID()}@example.test`,
        name: 'Ana María Solís',
        role: 'owner',
        passwordHash: 'not-a-real-hash',
      },
    });
    users.push(user.id);
    const token: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: 'owner',
      sid: randomUUID(),
    };
    return { user, token };
  };

  const clinicAccount = async () => {
    const user = await db.user.create({
      data: {
        email: `clinic-${randomUUID()}@example.test`,
        name: 'Clínica de prueba',
        role: 'clinic',
        passwordHash: 'not-a-real-hash',
      },
    });
    users.push(user.id);
    const clinic = await db.clinic.create({
      data: {
        name: 'Clínica de prueba',
        staff: { create: { userId: user.id, position: 'admin' } },
      },
    });
    clinicIds.push(clinic.id);
    const token: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: 'clinic',
      sid: randomUUID(),
    };
    return { user, clinic, token };
  };

  const started = async (token: TokenPayload) => {
    const { orderNumber, url } = await billing.checkout(
      token,
      token.role === 'clinic' ? 'office' : 'premium',
      ORIGIN,
    );
    const payment = await db.payment.findUniqueOrThrow({
      where: { orderNumber },
    });
    return { orderNumber, url, sessionId: payment.providerSessionId! };
  };

  describe('starting a payment', () => {
    it('creates an ONVO session for the plan amount in céntimos', async () => {
      const { user, token } = await owner();
      const { orderNumber, url, sessionId } = await started(token);

      expect(url).toBe(`https://checkout.onvopay.com/${sessionId}`);
      const [sent] = calls;
      expect(sent.method).toBe('POST');
      expect(sent.path).toBe('/v1/checkout/sessions/one-time-link');
      expect(sent.authorization).toBe(`Bearer ${KEY}`);
      expect(sent.body).toMatchObject({
        lineItems: [
          {
            quantity: 1,
            unitAmount: PAID_PLANS.premium.amountCrc * 100,
            currency: 'CRC',
          },
        ],
        customerEmail: user.email,
        customerName: user.name,
        redirectUrl: `${ORIGIN}/pago?order=${orderNumber}`,
        cancelUrl: `${ORIGIN}/pago?order=${orderNumber}&cancelado=1`,
        metadata: { orderNumber },
      });

      const payment = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      expect(payment).toMatchObject({
        status: 'pending',
        provider: 'onvo',
        currency: 'CRC',
        clinicId: null,
        periodEnd: null,
      });
    });

    it('refuses foreign origins, other roles, and a missing key', async () => {
      const { token } = await owner();
      await expect(
        billing.checkout(token, 'premium', 'https://evil.example'),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        billing.checkout(token, 'office', ORIGIN),
      ).rejects.toMatchObject({ status: 403 });

      settings = { ONVO_SECRET_KEY: '', ALLOWED_ORIGINS: [ORIGIN] };
      const off = new BillingService(prisma, new OnvoClient(config), config);
      await expect(
        off.checkout(token, 'premium', ORIGIN),
      ).rejects.toMatchObject({ status: 503 });
      expect((await off.status(token)).enabled).toBe(false);
      expect(calls).toHaveLength(0);
    });

    it('declines the order and answers 503 when ONVO rejects the session', async () => {
      const { token } = await owner();
      override = () => ({
        status: 401,
        body: { statusCode: 401, message: 'Invalid key' },
      });
      await expect(
        billing.checkout(token, 'premium', ORIGIN),
      ).rejects.toMatchObject({ status: 503 });
      const [payment] = await db.payment.findMany({
        where: { userId: token.sub },
      });
      expect(payment.status).toBe('declined');
    });
  });

  describe('confirming a payment', () => {
    it('stays pending until the buyer pays, then activates the plan', async () => {
      const { token } = await owner();
      const { orderNumber, sessionId } = await started(token);

      expect((await billing.confirm(token, orderNumber)).status).toBe(
        'pending',
      );
      const intentId = pay(sessionId);
      const before = Date.now();
      const confirmed = await billing.confirm(token, orderNumber);

      expect(confirmed.status).toBe('approved');
      const periodEnd = new Date(confirmed.periodEnd!).getTime();
      expect(periodEnd).toBeGreaterThanOrEqual(before + PLAN_PERIOD_DAYS * DAY);
      const user = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(user.plan).toBe('premium');
      expect(user.planUntil?.getTime()).toBe(periodEnd);
      const payment = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      expect(payment.providerTransactionId).toBe(intentId);
      expect(payment.environment).toBe('test');

      // Confirming again neither calls ONVO nor extends the plan.
      calls = [];
      expect((await billing.confirm(token, orderNumber)).periodEnd).toBe(
        confirmed.periodEnd,
      );
      expect(calls).toHaveLength(0);
    });

    it('puts a clinic plan on the clinic, not on the payer', async () => {
      const { clinic, token } = await clinicAccount();
      const { orderNumber, sessionId } = await started(token);
      pay(sessionId);
      await billing.confirm(token, orderNumber);

      const updated = await db.clinic.findUniqueOrThrow({
        where: { id: clinic.id },
      });
      expect(updated.plan).toBe('office');
      expect(updated.planUntil).not.toBeNull();
      const payer = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(payer.plan).toBe('free');
    });

    it('declines an expired session', async () => {
      const { token } = await owner();
      const { orderNumber, sessionId } = await started(token);
      sessions.set(sessionId, {
        ...sessions.get(sessionId)!,
        status: 'expired',
      });
      expect((await billing.confirm(token, orderNumber)).status).toBe(
        'declined',
      );
    });

    it.each([
      ['a smaller amount', { amount: 100 }, {}],
      ['another currency', { currency: 'USD' }, {}],
      ['a live payment', { mode: 'live' }, {}],
      ['an intent that did not succeed', { status: 'failed' }, {}],
      ['another order', {}, { metadata: { orderNumber: 'VTFOTHER' } }],
    ])('never approves %s', async (_name, intentOver, sessionOver) => {
      const { token } = await owner();
      const { orderNumber, sessionId } = await started(token);
      pay(sessionId, intentOver, sessionOver);

      await expect(billing.confirm(token, orderNumber)).rejects.toMatchObject({
        status: 503,
      });
      // Kept pending for review: a real payment is never lost to a decline.
      expect(
        (await db.payment.findUniqueOrThrow({ where: { orderNumber } })).status,
      ).toBe('pending');
      const user = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(user.plan).toBe('free');
    });

    it('answers 503 and keeps the payment pending when ONVO errors', async () => {
      const { token } = await owner();
      const { orderNumber, sessionId } = await started(token);
      pay(sessionId);
      for (const status of [401, 403, 500]) {
        override = () => ({ status, body: { statusCode: status } });
        await expect(billing.confirm(token, orderNumber)).rejects.toMatchObject(
          { status: 503 },
        );
      }
      override = undefined;
      expect(
        (await db.payment.findUniqueOrThrow({ where: { orderNumber } })).status,
      ).toBe('pending');
      expect((await billing.confirm(token, orderNumber)).status).toBe(
        'approved',
      );
    });

    it("hides other users' payments", async () => {
      const { token } = await owner();
      const other = await owner();
      const { orderNumber } = await started(token);
      await expect(
        billing.confirm(other.token, orderNumber),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('the webhook', () => {
    it('activates the plan from a completed-session event', async () => {
      const { token } = await owner();
      const { orderNumber, sessionId } = await started(token);
      pay(sessionId);

      await billing.handleEvent({
        type: 'checkout_session.succeeded',
        data: { object: { id: sessionId } },
      });
      const payment = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      expect(payment.status).toBe('approved');
    });

    it('reads ONVO back instead of trusting the event', async () => {
      const { token } = await owner();
      const { orderNumber, sessionId } = await started(token);

      await billing.handleEvent({
        type: 'checkout_session.succeeded',
        data: { object: { id: sessionId } },
      });
      expect(
        (await db.payment.findUniqueOrThrow({ where: { orderNumber } })).status,
      ).toBe('pending');
    });

    it('ignores other events and unknown sessions', async () => {
      calls = [];
      await billing.handleEvent({
        type: 'payment_intent.failed',
        data: { object: { id: 'pi_x' } },
      });
      await billing.handleEvent({
        type: 'checkout_session.succeeded',
        data: { object: { id: 'cs_unknown' } },
      });
      expect(calls).toHaveLength(0);
    });

    it('activates the plan once when the browser and the webhook race', async () => {
      const { token } = await owner();
      const { orderNumber, sessionId } = await started(token);
      pay(sessionId);

      await Promise.all([
        billing.confirm(token, orderNumber),
        billing.handleEvent({
          type: 'checkout_session.succeeded',
          data: { object: { id: sessionId } },
        }),
        billing.confirm(token, orderNumber),
      ]);
      const payment = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      const user = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(payment.status).toBe('approved');
      expect(user.planUntil?.getTime()).toBe(payment.periodEnd?.getTime());
    });
  });
});
