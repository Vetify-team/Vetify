import { z } from "zod";
import { dateTimeSchema } from "./common.js";

/**
 * Paid plans and their monthly prices in colones. The prices come from the
 * business model (docs/AVANCE_2.md §3); the API charges these amounts, the web
 * shows them. A payment buys one month of the plan.
 */
export const paidPlanIdSchema = z.enum(["premium", "office", "clinic", "chain"]);
export type PaidPlanId = z.infer<typeof paidPlanIdSchema>;

export const PAID_PLANS: Record<
  PaidPlanId,
  { role: "owner" | "clinic"; name: string; amountCrc: number }
> = {
  premium: { role: "owner", name: "Premium", amountCrc: 1500 },
  office: { role: "clinic", name: "Consultorio", amountCrc: 15000 },
  clinic: { role: "clinic", name: "Clínica", amountCrc: 30000 },
  chain: { role: "clinic", name: "Cadena", amountCrc: 45000 },
};

/** Days a payment extends the plan. */
export const PLAN_PERIOD_DAYS = 30;

/** Pets an owner can have without Premium. */
export const FREE_PLAN_LIMIT = 2;

export const checkoutSchema = z.object({ plan: paidPlanIdSchema });
export type Checkout = z.infer<typeof checkoutSchema>;

export const confirmPaymentSchema = z.object({
  orderNumber: z.string().min(1).max(64),
});
export type ConfirmPayment = z.infer<typeof confirmPaymentSchema>;

export const paymentStatusSchema = z.enum(["pending", "approved", "declined"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentSchema = z.object({
  orderNumber: z.string(),
  plan: paidPlanIdSchema,
  amount: z.string(),
  currency: z.string(),
  status: paymentStatusSchema,
  /** Until when this payment's plan is active; null until approved. */
  periodEnd: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
});
export type Payment = z.infer<typeof paymentSchema>;

export const billingStatusSchema = z.object({
  /** False when the API has no payment provider configured. */
  enabled: z.boolean(),
  /** "free" (owner) or "pilot" (clinic) unless a paid plan is active. */
  plan: z.string(),
  planUntil: dateTimeSchema.nullable(),
  payments: z.array(paymentSchema),
});
export type BillingStatus = z.infer<typeof billingStatusSchema>;
