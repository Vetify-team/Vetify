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
  TilopayClient,
  TilopayError,
  type TilopayPaymentRequest,
} from '../src/billing/tilopay.client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { Env } from '../src/config.js';

// Same rule as the other integration suite: never the app's own database.
const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const ORIGIN = 'https://app.vetify.example';
const DAY = 24 * 60 * 60 * 1000;

const credentials = {
  TILOPAY_API_USER: 'api-user',
  TILOPAY_PASSWORD: 'api-password',
  TILOPAY_KEY: 'tilopay-key',
};
let settings: Record<string, unknown> = {};
const config = {
  get: (key: string) => settings[key],
} as unknown as ConfigService<Env, true>;

interface Reply {
  status: number;
  body: unknown;
}
type Handler = (body: Record<string, unknown>) => Reply;
type Route = 'login' | 'processPayment' | 'consult';
interface RecordedCall {
  path: string;
  body: Record<string, unknown>;
  authorization?: string;
}

let calls: RecordedCall[] = [];
let logins = 0;
let handlers: Record<Route, Handler>;

/** A transaction shaped like the ones POST /api/v1/consult returns. */
const transaction = (
  orderNumber: unknown,
  over: Record<string, unknown> = {},
) => ({
  id_tilopay: 777,
  orderNumber,
  amount: '1500.00',
  currency: 'CRC',
  code: '1',
  response: 'Transaccion aprobada',
  environment: 'Test',
  ...over,
});

const defaultHandlers = (): Record<Route, Handler> => ({
  login: () => ({
    status: 200,
    body: { access_token: `token-${++logins}`, expires_in: 86_400 },
  }),
  processPayment: (body) => ({
    status: 200,
    body: {
      type: '100',
      url: `https://app.tilopay.com/payment/${String(body.orderNumber)}`,
    },
  }),
  consult: (body) => ({
    status: 200,
    body: { response: [transaction(body.orderNumber)] },
  }),
});

/** Stands in for app.tilopay.com and records what the client sent. */
const tilopayDouble = vi.fn(
  async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(input)).pathname;
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : {};
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ path, body, authorization: headers.Authorization });
    const route: Route = path.endsWith('/login')
      ? 'login'
      : path.endsWith('/processPayment')
        ? 'processPayment'
        : 'consult';
    const reply = handlers[route](body);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
);

const callsTo = (suffix: string) =>
  calls.filter((call) => call.path.endsWith(suffix));

const paymentRequest = (orderNumber = 'VTFTEST1'): TilopayPaymentRequest => ({
  orderNumber,
  amount: '1500.00',
  currency: 'CRC',
  redirect: `${ORIGIN}/pago`,
  buyer: {
    firstName: 'Ana',
    lastName: 'Solís',
    email: 'ana@example.test',
    telephone: '22223333',
  },
});

describe.skipIf(!databaseUrl)('Tilopay payments', () => {
  let db: PrismaClient;
  let prisma: PrismaService;
  let billing: BillingService;
  let tilopay: TilopayClient;
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
    settings = {
      ...credentials,
      TILOPAY_ENVIRONMENT: 'test',
      ALLOWED_ORIGINS: [ORIGIN],
    };
    calls = [];
    logins = 0;
    handlers = defaultHandlers();
    vi.stubGlobal('fetch', tilopayDouble);
    tilopay = new TilopayClient(config);
    billing = new BillingService(prisma, tilopay, config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    tilopayDouble.mockClear();
  });

  const owner = async (name = 'Ana María Solís') => {
    const user = await db.user.create({
      data: {
        email: `billing-${randomUUID()}@example.test`,
        name,
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

  describe('the Tilopay client', () => {
    it('logs in once, reuses the token and sends what Tilopay expects', async () => {
      const { user, token } = await owner();

      const first = await billing.checkout(token, 'premium', ORIGIN);
      await billing.checkout(token, 'premium', ORIGIN);

      expect(callsTo('/login')).toHaveLength(1);
      expect(callsTo('/processPayment')).toHaveLength(2);
      expect(first.url).toContain(first.orderNumber);
      const [sent] = callsTo('/processPayment');
      expect(sent.authorization).toBe('bearer token-1');
      expect(sent.body).toMatchObject({
        key: 'tilopay-key',
        amount: '1500.00',
        currency: 'CRC',
        capture: '1',
        subscription: '0',
        platform: 'api',
        redirect: `${ORIGIN}/pago`,
        orderNumber: first.orderNumber,
        billToEmail: user.email,
        billToFirstName: 'Ana',
        billToLastName: 'María Solís',
        billToCountry: 'CR',
      });
    });

    it('logs in again after Tilopay rejects the token', async () => {
      handlers.processPayment = () => ({
        status: 401,
        body: { message: 'Unauthenticated' },
      });
      await expect(tilopay.createPayment(paymentRequest())).rejects.toThrow(
        TilopayError,
      );

      handlers.processPayment = defaultHandlers().processPayment;
      await expect(tilopay.createPayment(paymentRequest())).resolves.toContain(
        'VTFTEST1',
      );
      expect(callsTo('/login')).toHaveLength(2);
    });

    it('fails when Tilopay does not return a payment form', async () => {
      handlers.processPayment = () => ({
        status: 200,
        body: { type: '0', message: 'Invalid amount' },
      });
      await expect(tilopay.createPayment(paymentRequest())).rejects.toThrow(
        TilopayError,
      );
    });

    it('fails when Tilopay is down or the credentials are wrong', async () => {
      handlers.processPayment = () => ({ status: 503, body: {} });
      await expect(tilopay.createPayment(paymentRequest())).rejects.toThrow(
        TilopayError,
      );

      handlers.login = () => ({ status: 401, body: { message: 'bad user' } });
      const fresh = new TilopayClient(config);
      await expect(fresh.createPayment(paymentRequest())).rejects.toThrow(
        /login failed/i,
      );
    });

    it('reports itself disabled without credentials', () => {
      settings = { TILOPAY_ENVIRONMENT: 'test', ALLOWED_ORIGINS: [ORIGIN] };
      expect(new TilopayClient(config).enabled).toBe(false);
      settings = { ...settings, ...credentials };
      expect(new TilopayClient(config).enabled).toBe(true);
    });

    it('prefers the approved attempt when an order has several', async () => {
      handlers.consult = (body) => ({
        status: 200,
        body: {
          response: [
            transaction(body.orderNumber, { code: '2', id_tilopay: 1 }),
            transaction(body.orderNumber, { code: '1', id_tilopay: 2 }),
            transaction(body.orderNumber, { code: '3', id_tilopay: 3 }),
          ],
        },
      });
      const tx = await tilopay.consult('VTFTEST1');
      expect(tx?.id_tilopay).toBe(2);
    });
  });

  describe('starting a payment', () => {
    it('records a pending payment for the plan amount', async () => {
      const { token } = await owner();
      const { orderNumber } = await billing.checkout(token, 'premium', ORIGIN);

      const payment = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      expect(payment.status).toBe('pending');
      expect(payment.amount.toFixed(2)).toBe(
        PAID_PLANS.premium.amountCrc.toFixed(2),
      );
      expect(payment.currency).toBe('CRC');
      expect(payment.provider).toBe('tilopay');
      expect(payment.clinicId).toBeNull();
      expect(payment.periodEnd).toBeNull();
    });

    it('only returns to one of our own origins', async () => {
      const { token } = await owner();
      await expect(
        billing.checkout(token, 'premium', 'https://evil.example'),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      await expect(
        billing.checkout(token, 'premium', undefined),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      expect(callsTo('/processPayment')).toHaveLength(0);
      expect(await db.payment.count({ where: { userId: token.sub } })).toBe(0);
    });

    it('refuses a plan meant for another kind of account', async () => {
      const { token } = await owner();
      await expect(
        billing.checkout(token, 'clinic', ORIGIN),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(await db.payment.count({ where: { userId: token.sub } })).toBe(0);
    });

    it('declines the payment it created when Tilopay fails', async () => {
      const { token } = await owner();
      handlers.processPayment = () => ({ status: 500, body: {} });

      await expect(
        billing.checkout(token, 'premium', ORIGIN),
      ).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE' });

      const payment = await db.payment.findFirstOrThrow({
        where: { userId: token.sub },
      });
      expect(payment.status).toBe('declined');
    });

    it('answers 503 and calls nobody when payments are not configured', async () => {
      const { token } = await owner();
      settings = { TILOPAY_ENVIRONMENT: 'test', ALLOWED_ORIGINS: [ORIGIN] };

      await expect(
        billing.checkout(token, 'premium', ORIGIN),
      ).rejects.toMatchObject({ code: 'BILLING_UNAVAILABLE' });
      expect(tilopayDouble).not.toHaveBeenCalled();
      expect(await db.payment.count({ where: { userId: token.sub } })).toBe(0);
      expect((await billing.status(token)).enabled).toBe(false);
    });
  });

  describe('confirming a payment', () => {
    it('activates the plan for one period and stores what Tilopay said', async () => {
      const { token } = await owner();
      const { orderNumber } = await billing.checkout(token, 'premium', ORIGIN);

      const confirmed = await billing.confirm(token, orderNumber);

      expect(confirmed.status).toBe('approved');
      const expected = Date.now() + PLAN_PERIOD_DAYS * DAY;
      expect(
        Math.abs(new Date(confirmed.periodEnd!).getTime() - expected),
      ).toBeLessThan(60_000);

      const row = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      expect(row.environment).toBe('Test');
      expect(row.providerTransactionId).toBe('777');
      expect(row.confirmedAt).not.toBeNull();

      const account = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(account.plan).toBe('premium');
      expect(account.planUntil?.getTime()).toBe(
        new Date(confirmed.periodEnd!).getTime(),
      );
      expect((await billing.status(token)).plan).toBe('premium');
    });

    it('is safe to confirm again: it never buys a second period', async () => {
      const { token } = await owner();
      const { orderNumber } = await billing.checkout(token, 'premium', ORIGIN);
      const first = await billing.confirm(token, orderNumber);

      const again = await billing.confirm(token, orderNumber);

      expect(again).toEqual(first);
      expect(callsTo('/consult')).toHaveLength(1);
      const account = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(account.planUntil?.toISOString()).toBe(first.periodEnd);
    });

    it('activates once when two confirmations race', async () => {
      const { token } = await owner();
      const { orderNumber } = await billing.checkout(token, 'premium', ORIGIN);

      const [a, b] = await Promise.all([
        billing.confirm(token, orderNumber),
        billing.confirm(token, orderNumber),
      ]);

      expect([a.status, b.status]).toEqual(['approved', 'approved']);
      const account = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      const expected = Date.now() + PLAN_PERIOD_DAYS * DAY;
      expect(
        Math.abs((account.planUntil?.getTime() ?? 0) - expected),
      ).toBeLessThan(60_000);
    });

    it('extends from the end of the period when paying early', async () => {
      const { token } = await owner();
      const one = await billing.checkout(token, 'premium', ORIGIN);
      await billing.confirm(token, one.orderNumber);
      const two = await billing.checkout(token, 'premium', ORIGIN);

      const second = await billing.confirm(token, two.orderNumber);

      const expected = Date.now() + 2 * PLAN_PERIOD_DAYS * DAY;
      expect(
        Math.abs(new Date(second.periodEnd!).getTime() - expected),
      ).toBeLessThan(60_000);
    });

    it('stays pending while Tilopay has no record of the order', async () => {
      const { token } = await owner();
      const { orderNumber } = await billing.checkout(token, 'premium', ORIGIN);
      handlers.consult = () => ({ status: 200, body: { response: [] } });

      const result = await billing.confirm(token, orderNumber);

      expect(result.status).toBe('pending');
      expect(result.periodEnd).toBeNull();
      const account = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(account.plan).toBe('free');
    });

    it('declines a transaction Tilopay did not approve', async () => {
      const { token } = await owner();
      const { orderNumber } = await billing.checkout(token, 'premium', ORIGIN);
      handlers.consult = (body) => ({
        status: 200,
        body: {
          response: [
            transaction(body.orderNumber, {
              code: '2',
              response: 'Tarjeta rechazada',
            }),
          ],
        },
      });

      const result = await billing.confirm(token, orderNumber);

      expect(result.status).toBe('declined');
      const account = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(account.plan).toBe('free');
      expect(account.planUntil).toBeNull();
    });

    it.each([
      ['another amount', { amount: '15.00' }],
      ['another currency', { currency: 'USD' }],
      ['another order', { orderNumber: 'VTFSOMEONEELSE' }],
      ['the production environment', { environment: 'Production' }],
    ])('never approves a transaction with %s', async (_label, over) => {
      const { token } = await owner();
      const { orderNumber } = await billing.checkout(token, 'premium', ORIGIN);
      handlers.consult = (body) => ({
        status: 200,
        body: { response: [transaction(body.orderNumber, over)] },
      });

      const result = await billing.confirm(token, orderNumber);

      expect(result.status).not.toBe('approved');
      const account = await db.user.findUniqueOrThrow({
        where: { id: token.sub },
      });
      expect(account.plan).toBe('free');
      expect(account.planUntil).toBeNull();
    });

    it("hides another owner's order", async () => {
      const mine = await owner();
      const other = await owner('Otro Dueño');
      const { orderNumber } = await billing.checkout(
        mine.token,
        'premium',
        ORIGIN,
      );

      await expect(
        billing.confirm(other.token, orderNumber),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      const row = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      expect(row.status).toBe('pending');
    });
  });

  describe('clinic plans', () => {
    it('gives the plan to the clinic, not to the user who paid', async () => {
      const { user, clinic, token } = await clinicAccount();
      handlers.consult = (body) => ({
        status: 200,
        body: {
          response: [transaction(body.orderNumber, { amount: '15000.00' })],
        },
      });

      const { orderNumber } = await billing.checkout(token, 'office', ORIGIN);
      const confirmed = await billing.confirm(token, orderNumber);

      expect(confirmed.status).toBe('approved');
      const row = await db.payment.findUniqueOrThrow({
        where: { orderNumber },
      });
      expect(row.clinicId).toBe(clinic.id);
      expect(row.amount.toFixed(2)).toBe(
        PAID_PLANS.office.amountCrc.toFixed(2),
      );
      const updated = await db.clinic.findUniqueOrThrow({
        where: { id: clinic.id },
      });
      expect(updated.plan).toBe('office');
      expect(updated.planUntil).not.toBeNull();
      const payer = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(payer.plan).toBe('free');
      expect((await billing.status(token)).plan).toBe('office');
    });

    it('refuses a clinic plan for a user with no clinic', async () => {
      const user = await db.user.create({
        data: {
          email: `orphan-${randomUUID()}@example.test`,
          name: 'Sin clínica',
          role: 'clinic',
          passwordHash: 'not-a-real-hash',
        },
      });
      users.push(user.id);
      const token: TokenPayload = {
        sub: user.id,
        email: user.email,
        role: 'clinic',
        sid: randomUUID(),
      };

      await expect(
        billing.checkout(token, 'office', ORIGIN),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(callsTo('/processPayment')).toHaveLength(0);
    });
  });
});
