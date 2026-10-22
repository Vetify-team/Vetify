"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyClinic } from "@/hooks/useClinic";
import type { StepProps } from "@/lib/onboarding";
import { cn } from "cn";
import { primaryAction, StepActions, StepTitle } from "../wizard-shell";

/** What happens to a new clinic: Vetify verifies it before it can receive records. */
export function ClinicReviewStep({ data, next }: StepProps) {
  const clinic = useMyClinic();
  const name = clinic.data?.name ?? data.clinicName;
  const verified = clinic.data?.verified ?? false;

  const items = [
    { text: "Cuenta creada", done: true },
    { text: "Datos de la clínica recibidos", done: true },
    { text: "Verificación de Vetify", done: verified },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <StepTitle
        description={`Vetify revisa cada clínica antes de que pueda recibir expedientes, para que nadie se haga pasar por otra. Te avisamos a ${data.email} cuando esté verificada.`}
      >
        {verified ? `${name} está verificada` : `${name} está en revisión`}
      </StepTitle>
      <ul className="border-t border-filete">
        {items.map((item) => (
          <li
            key={item.text}
            className="flex items-center gap-3.5 border-b border-border py-3.5"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-primary",
                item.done && "bg-primary",
              )}
            >
              {item.done && (
                <Check
                  className="size-3.5 text-primary-foreground"
                  strokeWidth={3}
                  aria-hidden
                />
              )}
            </span>
            <span className="flex-1">{item.text}</span>
            <span className="text-xs text-primary">
              {item.done ? "Listo" : "En curso"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Mientras tanto podés explorar el portal y elegir tu plan.
      </p>
      <StepActions>
        <Button variant="solido" size="lg" className={primaryAction} onClick={next}>
          Continuar
        </Button>
      </StepActions>
    </div>
  );
}
