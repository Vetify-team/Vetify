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
  judgeTransaction,
  newOrderNumber,
  splitName,
} from './billing.logic.js';
import { TilopayClient, TilopayError } from './tilopay.client.js';

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

/**
 * Paid plans through Tilopay's hosted payment page. The browser is sent to
 * Tilopay and comes back to /pago; a payment is approved only after the API
 * consults Tilopay for that order (the return parameters are not trusted).
 * One approved payment buys PLAN_PERIOD_DAYS of the plan.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tilopay: TilopayClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async status(user: TokenPayload): Promise<BillingStatus> {
    const now = new Date();
    const { plan, until } = await this.currentPlan(user, now);
    const payments = await this.prisma.payment.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    return {
      enabled: this.tilopay.enabled,
      plan,
      planUntil: until?.toISOString() ?? null,
      payments: payments.map(toDto),
    };
  }

  /** Creates a pending payment and returns Tilopay's payment form URL. */
  async checkout(
    user: TokenPayload,
    planId: PaidPlanId,
    origin: string | undefined,
  ): Promise<{ url: string; orderNumber: string }> {
    if (!this.tilopay.enabled) throw unavailable();
    const plan = PAID_PLANS[planId];
    if (plan.role !== user.role)
      throw forbidden('This plan is for another kind of account');
    const allowed = this.config.get('ALLOWED_ORIGINS', { infer: true });
    // Tilopay returns the browser here; only our own sites qualify.
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
      },
    });
    try {
      const url = await this.tilopay.createPayment({
        orderNumber: payment.orderNumber,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
        redirect: `${origin}/pago`,
        buyer: {
          ...splitName(account.name),
          email: account.email,
          telephone: account.phone?.replace(/\D/g, '') || '00000000',
        },
      });
      return { url, orderNumber: payment.orderNumber };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'declined' },
      });
      if (error instanceof TilopayError) throw unavailable(error.message);
      throw error;
    }
  }

  /**
   * Asks Tilopay what happened with an order and, if it was approved for the
   * right amount, currency and environment, activates the plan. Safe to call
   * again: an approved payment is returned as is.
   */
  async confirm(user: TokenPayload, orderNumber: string): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderNumber },
    });
    if (!payment || payment.userId !== user.sub)
      throw notFound('Payment not found');
    if (payment.status === 'approved') return toDto(payment);
    if (!this.tilopay.enabled) throw unavailable();

    let tx;
    try {
      tx = await this.tilopay.consult(orderNumber);
    } catch (error) {
      if (error instanceof TilopayError) throw unavailable(error.message);
      throw error;
    }
    const verdict = judgeTransaction(tx, {
      orderNumber,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      environment: this.config.get('TILOPAY_ENVIRONMENT', { infer: true }),
    });
    if (verdict === 'mismatch') {
      this.logger.warn(
        `Tilopay record for ${orderNumber} does not match the payment`,
      );
    }
    if (verdict !== 'approved') {
      if (verdict === 'pending') return toDto(payment);
      return toDto(
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'declined', environment: tx?.environment ?? null },
        }),
      );
    }

    return this.prisma.$transaction(async (db) => {
      // Approve once, even if two confirmations race.
      const claimed = await db.payment.updateMany({
        where: { id: payment.id, status: { not: 'approved' } },
        data: { status: 'approved' },
      });
      if (claimed.count === 0) {
        return toDto(
          await db.payment.findUniqueOrThrow({ where: { id: payment.id } }),
        );
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
      return toDto(
        await db.payment.update({
          where: { id: payment.id },
          data: {
            periodEnd,
            confirmedAt: now,
            environment: tx?.environment ?? null,
            providerTransactionId:
              tx?.id_tilopay != null ? String(tx.id_tilopay) : null,
          },
        }),
      );
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
