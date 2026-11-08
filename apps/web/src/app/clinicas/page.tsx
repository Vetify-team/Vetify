import { Mail } from "lucide-react";
import type { Metadata } from "next";
import {
  CONTACT_EMAIL,
  LandingShell,
  SectionHeading,
  Step,
} from "@/components/landing/landing-shell";
import { buttonVariants } from "@/components/ui/button";
import { CLINIC_PLANS } from "@/lib/plans";
import { siteHref } from "@/lib/sites";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Para clínicas",
  description:
    "Vetify para clínicas veterinarias: escribinos para elegir un plan y recibir el acceso de tu clínica.",
  alternates: { canonical: "/clinicas" },
};

const SUBJECT = "Acceso para mi clínica en Vetify";
const BODY = [
  "Hola, quiero usar Vetify en mi clínica.",
  "",
  "Nombre de la clínica:",
  "Provincia y cantón:",
  "Cantidad de veterinarios:",
  "Teléfono de contacto:",
  "Plan de interés:",
].join("\n");

/**
 * How a clinic gets access: it writes to an administrator, agrees on a plan
 * and payment, and receives the link to register. The clinic is verified
 * before it can see patients, as before.
 */
export default function ClinicsPage() {
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;

  return (
    <LandingShell>
      <section className="mx-auto grid max-w-6xl gap-14 px-5 pt-16 pb-20 md:grid-cols-[1.4fr_1fr] md:pt-20">
        <div className="flex flex-col">
          <SectionHeading
            as="h1"
            label="Para clínicas"
            title="Sumá tu clínica a Vetify"
          />
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            El acceso para clínicas lo habilita un administrador de Vetify. Escribinos: te
            contamos los planes, coordinamos el pago y te enviamos el enlace para
            registrar tu clínica.
          </p>

          <ol className="mt-10 flex flex-col divide-y divide-border border-y border-border">
            <Step n={1} title="Escribinos">
              Contanos el nombre de la clínica, dónde está y cuántos veterinarios la van a
              usar.
            </Step>
            <Step n={2} title="Elegimos el plan y coordinamos el pago">
              Te ayudamos a escoger el plan que calza con tu clínica.
            </Step>
            <Step n={3} title="Te enviamos el enlace de acceso">
              Con ese enlace registrás la cuenta de la clínica.
            </Step>
            <Step n={4} title="Verificamos la clínica y empezás">
              Revisamos los datos y habilitamos la clínica para atender pacientes.
            </Step>
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={mailto}
              className={cn(buttonVariants({ variant: "solido" }), "h-11 gap-2 px-5")}
            >
              <Mail className="size-4" aria-hidden />
              Escribir a un administrador
            </a>
            <a
              href={siteHref("clinic", "/iniciar-sesion")}
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}
            >
              Ya tengo acceso
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            O escribí directamente a{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>

        <aside className="self-start rounded-2xl border border-border bg-card p-7">
          <p className="etiqueta">Planes para clínicas</p>
          <ul className="mt-4 flex flex-col divide-y divide-border border-y border-border">
            {CLINIC_PLANS.map((plan) => (
              <li key={plan.id} className="flex flex-col gap-1 py-4">
                <span className="flex items-baseline gap-3">
                  <span className="flex-1 font-display text-2xl leading-none">
                    {plan.name}
                  </span>
                  <span className="font-display text-2xl leading-none text-primary">
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted-foreground">{plan.period}</span>
                </span>
                <span className="text-sm text-muted-foreground">{plan.summary}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Precios en colones.</p>
        </aside>
      </section>
    </LandingShell>
  );
}
