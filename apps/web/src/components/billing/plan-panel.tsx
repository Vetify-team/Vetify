"use client";

import { PAID_PLANS, type PaidPlanId } from "@vetify/types";
import { Check } from "lucide-react";
import { Row, Section } from "@/components/system";
import { FormError } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { useBillingStatus, useCheckout } from "@/hooks/useBilling";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { CLINIC_PLANS, OWNER_PLANS } from "@/lib/plans";

const STATUS_TEXT = { pending: "Pendiente", approved: "Aprobado", declined: "Rechazado" };

/**
 * The account's plan and the paid plans it can buy. A payment goes to
 * ONVO's hosted Checkout and comes back to /pago, where the API confirms it.
 */
export function PlanPanel({ role }: { role: "owner" | "clinic" }) {
  const status = useBillingStatus();
  const checkout = useCheckout();
  const plans = (role === "owner" ? OWNER_PLANS : CLINIC_PLANS).filter(
    (plan): plan is typeof plan & { id: PaidPlanId } => plan.id in PAID_PLANS,
  );
  const current = status.data;
  const currentName =
    current && current.plan in PAID_PLANS
      ? PAID_PLANS[current.plan as PaidPlanId].name
      : role === "owner"
        ? "Gratuito"
        : "Piloto";

  return (
    <Section title="Plan">
      <Row
        title={currentName}
        detail={
          current?.planUntil
            ? `Activo hasta el ${formatDate(current.planUntil)}`
            : role === "owner"
              ? "Todo lo esencial, sin costo."
              : "Piloto sin costo para las primeras clínicas."
        }
      />

      {current && !current.enabled && (
        <p className="pt-4 text-sm text-muted-foreground">
          Los planes pagos se habilitan pronto.
        </p>
      )}

      {current?.enabled && (
        <ul className="flex flex-col">
          {plans.map((plan) => {
            const active = current.plan === plan.id && current.planUntil;
            return (
              <li key={plan.id} className="fila flex flex-col gap-2">
                <span className="flex items-baseline gap-2">
                  <span className="flex-1 font-display text-2xl leading-none">
                    {plan.name}
                  </span>
                  <span className="font-display text-2xl leading-none text-primary">
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted-foreground">{plan.period}</span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  {plan.features.map((feature) => (
                    <span key={feature} className="flex items-center gap-1.5 text-sm">
                      <Check
                        className="size-3.5 text-primary"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      {feature}
                    </span>
                  ))}
                </span>
                <div>
                  <Button
                    variant={active ? "outline" : "solido"}
                    disabled={checkout.isPending}
                    onClick={() => checkout.mutate(plan.id)}
                  >
                    {active ? "Pagar otro mes" : `Pasarme a ${plan.name}`}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FormError message={checkout.error ? errorMessage(checkout.error) : null} />

      {current && current.payments.length > 0 && (
        <details className="pt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Pagos recientes
          </summary>
          <ul className="mt-2 flex flex-col">
            {current.payments.map((payment) => (
              <li key={payment.orderNumber} className="fila flex items-baseline gap-3">
                <span className="flex-1">
                  {PAID_PLANS[payment.plan].name} · {formatDate(payment.createdAt)}
                </span>
                <span className="font-mono text-xs">
                  ₡{Number(payment.amount).toLocaleString("es-CR")}
                </span>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {STATUS_TEXT[payment.status]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="pt-4 text-xs text-muted-foreground">
        El pago se procesa en ONVO; Vetify no ve ni guarda los datos de tu tarjeta. Cada
        pago activa el plan por 30 días.
      </p>
    </Section>
  );
}
