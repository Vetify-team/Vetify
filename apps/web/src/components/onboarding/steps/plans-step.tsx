"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StepProps } from "@/lib/onboarding";
import { CLINIC_PLANS, CLINIC_TERMS, OWNER_PLANS, OWNER_TERMS } from "@/lib/plans";
import { ChoiceCard } from "../choice-card";
import { primaryAction, StepActions, StepTitle } from "../wizard-shell";

/**
 * The plans, before entering the app. Billing does not exist yet: a paid plan
 * can be looked at, and the account starts on the plan that is available.
 */
export function PlansStep({ data, update, next }: StepProps) {
  const owner = data.role === "owner";
  const plans = owner ? OWNER_PLANS : CLINIC_PLANS;
  const selected = plans.find((p) => p.id === data.plan) ?? plans[0];
  const starting = selected.available ? selected : plans.find((p) => p.available)!;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <StepTitle
        description={
          owner
            ? "Podés cambiar de plan cuando quieras."
            : "Empezá con el piloto y elegí después."
        }
      >
        {owner ? "Elegí cómo empezar" : "Elegí el plan de tu clínica"}
      </StepTitle>

      <div className="flex flex-col gap-2.5">
        {plans.map((plan) => (
          <ChoiceCard
            key={plan.id}
            selected={plan.id === selected.id}
            onClick={() => update({ plan: plan.id })}
            className="flex flex-col gap-2 rounded-2xl px-4.5 py-4"
          >
            <span className="flex items-baseline gap-2">
              <span className="flex-1 font-display text-[1.65rem] leading-none">
                {plan.name}
              </span>
              <span className="font-display text-[1.65rem] leading-none text-primary">
                {plan.price}
              </span>
              <span className="text-xs text-muted-foreground">{plan.period}</span>
            </span>
            <span className="text-sm text-muted-foreground">{plan.summary}</span>
            <span className="flex flex-col gap-1">
              {plan.features.map((feature) => (
                <span key={feature} className="flex items-center gap-2 text-sm">
                  <Check
                    className="size-3.5 text-primary"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {feature}
                </span>
              ))}
            </span>
            {!plan.available && (
              <span className="etiqueta !text-primary">Disponible pronto</span>
            )}
          </ChoiceCard>
        ))}
      </div>

      {!selected.available && (
        <p className="border-l-2 border-primary py-1 pl-3 text-sm" aria-live="polite">
          {selected.name} se habilita pronto. Mientras tanto empezás con {starting.name} y
          te avisamos cuando puedas cambiar.
        </p>
      )}

      <StepActions>
        <Button
          variant="solido"
          size="lg"
          className={primaryAction}
          onClick={() => {
            update({ plan: starting.id });
            next();
          }}
        >
          Empezar con {starting.name}
        </Button>
        <Dialog>
          <DialogTrigger className="min-h-10 text-sm text-primary underline underline-offset-4">
            Ver condiciones de los planes
          </DialogTrigger>
          <DialogContent className="gap-4 p-6">
            <DialogTitle className="font-display text-2xl">Condiciones</DialogTitle>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
              {(owner ? OWNER_TERMS : CLINIC_TERMS).map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
            <DialogClose render={<Button variant="outline" size="lg" />}>
              Entendido
            </DialogClose>
          </DialogContent>
        </Dialog>
      </StepActions>
    </div>
  );
}
