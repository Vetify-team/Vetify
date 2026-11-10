import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAID_PLANS,
  PLAN_PERIOD_DAYS,
  type BillingStatus,
  type PaidPlanId,
  type Payment as PaymentDto,
  type TokenPayload,
} from '@vetify/types';
import type { Env } from '../config.js';
import {
  AppException,
  badRequest,
  forbidden,
  notFound,
} from '../common/errors.js';
import type { Payment } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  effectivePlan,
  extendPeriod,
  judgeSession,
  newOrderNumber,
  toMinorUnits,
} from './billing.logic.js';
import { OnvoClient, OnvoError } from './onvo.client.js';

const unavailable = (message = 'Payments are not available') =>
  new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'BILLING_UNAVAILABLE',
    message,
  );

const toDto = (p: Payment): PaymentDto => ({
  orderNumber: p.orderNumber,
  plan: p.plan as PaidPlanId,
  amount: p.amount.toFixed(2),
  currency: p.currency,
  status: p.status as PaymentDto['status'],
  periodEnd: p.periodEnd?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
});

/** Pending payments rechecked when the plan is shown: newest 3 of the last 7 days. */
const RECHECK_WINDOW_MS = 7 * 86_400_000;
const RECHECK_LIMIT = 3;

/** The part of an ONVO webhook event this service reads. */
export interface OnvoEvent {
  type?: string;
  data?: { object?: { id?: unknown } };
}

/**
 * Paid plans through ONVO's hosted Checkout. The browser is sent to ONVO and
 * comes back to /pago; a payment is approved only after the API reads the
 * session (and its payment intent) back from ONVO, whether the browser's
 * return or ONVO's webhook asks. Neither is trusted on its own. One approved
 * payment buys PLAN_PERIOD_DAYS of the plan.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly onvo: OnvoClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Payments are on: an ONVO key is configured. */
  get enabled(): boolean {
    return this.onvo.enabled;
  }

  async status(user: TokenPayload): Promise<BillingStatus> {
    const now = new Date();
    await this.settleRecent(user.sub, now);
    const { plan, until } = await this.currentPlan(user, now);
    const payments = await this.prisma.payment.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    return {
      enabled: this.onvo.enabled,
      plan,
      planUntil: until?.toISOString() ?? null,
      payments: payments.map(toDto),
    };
  }

  /**
   * There is no webhook: a buyer who paid and closed the tab before coming
   * back to /pago is settled the next time their plan is shown. Only the
   * newest few pending sessions of the last days are rechecked, and an ONVO
   * failure never stops the plan from loading.
   */
  private async settleRecent(userId: string, now: Date): Promise<void> {
    if (!this.onvo.enabled) return;
    const pending = await this.prisma.payment.findMany({
      where: {
        userId,
        status: 'pending',
        providerSessionId: { not: null },
        createdAt: { gt: new Date(now.getTime() - RECHECK_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: RECHECK_LIMIT,
    });
    for (const payment of pending) {
      try {
        await this.settle(payment);
      } catch (error) {
        this.logger.warn(
          `Could not recheck payment ${payment.orderNumber}: ${String(error)}`,
        );
      }
    }
  }

  /** Creates a pending payment and returns ONVO's Checkout URL. */
  async checkout(
    user: TokenPayload,
    planId: PaidPlanId,
    origin: string | undefined,
  ): Promise<{ url: string; orderNumber: string }> {
    if (!this.onvo.enabled) throw unavailable();
    const plan = PAID_PLANS[planId];
    if (plan.role !== user.role)
      throw forbidden('This plan is for another kind of account');
    const allowed = this.config.get('ALLOWED_ORIGINS', { infer: true });
    // ONVO returns the browser here; only our own sites qualify.
    if (!origin || !allowed.includes(origin)) {
      throw badRequest('Start the payment from the Vetify app');
    }
    const account = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });
    if (!account) throw notFound('User not found');
    const clinicId =
      plan.role === 'clinic'
        ? (
            await this.prisma.clinicStaff.findFirst({
              where: { userId: user.sub },
            })
          )?.clinicId
        : null;
    if (plan.role === 'clinic' && !clinicId)
      throw notFound('Your user is not linked to any clinic');

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.sub,
        clinicId,
        plan: planId,
        amount: plan.amountCrc.toFixed(2),
        currency: 'CRC',
        orderNumber: newOrderNumber(),
        provider: 'onvo',
      },
    });
    const back = `${origin}/pago?order=${payment.orderNumber}`;
    try {
      const session = await this.onvo.createCheckout({
        orderNumber: payment.orderNumber,
        amountMinor: toMinorUnits(payment.amount.toFixed(2)),
        currency: payment.currency,
        description: `Vetify ${plan.name} (${PLAN_PERIOD_DAYS} días)`,
        customerName: account.name,
        customerEmail: account.email,
        redirectUrl: back,
        cancelUrl: `${back}&cancelado=1`,
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerSessionId: session.id },
      });
      return { url: session.url, orderNumber: payment.orderNumber };
    } catch (error) {
      // Nobody received a URL for this order, so no one can pay it: a
      // session ONVO may have created anyway just expires.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'declined' },
      });
      if (error instanceof OnvoError) throw unavailable(error.message);
      throw error;
    }
  }

  /**
   * Reads the order's session back from ONVO and, if it was paid for the
   * right amount, currency and mode, activates the plan. Safe to call again:
   * an approved payment is returned as is.
   */
  async confirm(user: TokenPayload, orderNumber: string): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderNumber },
    });
    if (!payment || payment.userId !== user.sub)
      throw notFound('Payment not found');
    return toDto(await this.settle(payment));
  }

  /**
   * A verified ONVO event. Only completed Checkout sessions matter, and even
   * then the event is a prompt to read the session, never the evidence.
   */
  async handleEvent(event: OnvoEvent): Promise<void> {
    if (event.type !== 'checkout_session.succeeded') return;
    const sessionId = event.data?.object?.id;
    if (typeof sessionId !== 'string') return;
    const payment = await this.prisma.payment.findUnique({
      where: { providerSessionId: sessionId },
    });
    if (!payment) {
      this.logger.warn(`ONVO session ${sessionId} has no payment here`);
      return;
    }
    await this.settle(payment);
  }

  private async settle(payment: Payment): Promise<Payment> {
    if (payment.status !== 'pending') return payment;
    if (!payment.providerSessionId) {
      // The checkout never got a session (or predates ONVO): nothing to pay.
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'declined' },
      });
    }
    if (!this.onvo.enabled) throw unavailable();

    let session;
    let intent = null;
    try {
      session = await this.onvo.getSession(payment.providerSessionId);
      if (session.paymentStatus === 'paid') {
        if (!session.paymentIntentId)
          throw new OnvoError('ONVO reports a paid session without a payment');
        intent = await this.onvo.getPaymentIntent(session.paymentIntentId);
      }
    } catch (error) {
      if (error instanceof OnvoError) throw unavailable(error.message);
      throw error;
    }
    const verdict = judgeSession(session, intent, {
      orderNumber: payment.orderNumber,
      amount: toMinorUnits(payment.amount.toFixed(2)),
      currency: payment.currency,
      mode: this.onvo.mode,
    });
    if (verdict === 'pending') return payment;
    if (verdict === 'mismatch') {
      // Never approved, but not declined either: the buyer may have paid and
      // ONVO's answer may only look different. It stays pending for review.
      this.logger.warn(
        `ONVO session for ${payment.orderNumber} does not match the payment`,
      );
      throw unavailable('The payment could not be verified');
    }
    if (verdict === 'declined') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'declined', environment: session.mode ?? null },
      });
      return this.prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
    }

    return this.prisma.$transaction(async (db) => {
      // Approve once, even if the browser and the webhook race.
      const claimed = await db.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'approved' },
      });
      if (claimed.count === 0) {
        return db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      }
      const now = new Date();
      let periodEnd: Date;
      if (payment.clinicId) {
        const clinic = await db.clinic.findUniqueOrThrow({
          where: { id: payment.clinicId },
        });
        const current = clinic.plan === payment.plan ? clinic.planUntil : null;
        periodEnd = extendPeriod(current, now, PLAN_PERIOD_DAYS);
        await db.clinic.update({
          where: { id: payment.clinicId },
          data: { plan: payment.plan, planUntil: periodEnd },
        });
      } else {
        const owner = await db.user.findUniqueOrThrow({
          where: { id: payment.userId },
        });
        const current = owner.plan === payment.plan ? owner.planUntil : null;
        periodEnd = extendPeriod(current, now, PLAN_PERIOD_DAYS);
        await db.user.update({
          where: { id: payment.userId },
          data: { plan: payment.plan, planUntil: periodEnd },
        });
      }
      return db.payment.update({
        where: { id: payment.id },
        data: {
          periodEnd,
          confirmedAt: now,
          environment: intent?.mode ?? null,
          providerTransactionId: intent?.id ?? null,
        },
      });
    });
  }

  /** The plan in force for the user's account (the clinic's, for staff). */
  async currentPlan(
    user: TokenPayload,
    now = new Date(),
  ): Promise<{ plan: string; until: Date | null }> {
    if (user.role === 'clinic') {
      const staff = await this.prisma.clinicStaff.findFirst({
        where: { userId: user.sub },
        include: { clinic: true },
      });
      const clinic = staff?.clinic;
      return clinic && clinic.plan !== 'pilot'
        ? effectivePlan(clinic.plan, clinic.planUntil, now, 'pilot')
        : { plan: 'pilot', until: null };
    }
    const account = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });
    return account && account.plan !== 'free'
      ? effectivePlan(account.plan, account.planUntil, now, 'free')
      : { plan: 'free', until: null };
  }
}
