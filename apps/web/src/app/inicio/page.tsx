import {
  BellRing,
  Building2,
  CalendarCheck,
  Check,
  ClipboardList,
  KeyRound,
  PawPrint,
  QrCode,
  Scale,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingShell, SectionHeading } from "@/components/landing/landing-shell";
import { buttonVariants } from "@/components/ui/button";
import { CLINIC_PLANS, OWNER_PLANS, type Plan } from "@/lib/plans";
import { LANDING_PAGES, OWNER_PAGES, siteHref } from "@/lib/sites";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Vetify: el expediente clínico y el carné de vacunación digital de tu mascota. Vacunas, consultas y QR en un solo lugar; las clínicas veterinarias de Costa Rica registran con tu permiso.";

export const metadata: Metadata = {
  title: { absolute: "Vetify — Expediente clínico y carné de vacunación de tu mascota" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
};

/** Structured data so search engines know the brand, the site and the app. */
function structuredData() {
  const url = siteHref("landing", "/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}#organization`,
        name: "Vetify",
        url,
        logo: siteHref("landing", "/icons/icon-512.png"),
        areaServed: "CR",
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: "Vetify",
        url,
        inLanguage: "es-CR",
        publisher: { "@id": `${url}#organization` },
      },
      {
        "@type": "WebApplication",
        name: "Vetify",
        url,
        applicationCategory: "HealthApplication",
        operatingSystem: "Web",
        inLanguage: "es-CR",
        description: DESCRIPTION,
        offers: { "@type": "Offer", price: "0", priceCurrency: "CRC" },
        publisher: { "@id": `${url}#organization` },
      },
    ],
  };
}

/**
 * The public landing page (www). Served at "/" on the landing host and at
 * /inicio elsewhere; its calls to action go to the owner and clinic sites.
 */
export default async function LandingPage() {
  // The CSP nonce from src/proxy.ts; JSON-LD is data, but it still needs one.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // Owners install the app first; clinics ask an administrator for access.
  const install = siteHref("owner", OWNER_PAGES.install);
  const clinics = siteHref("landing", LANDING_PAGES.clinics);
  const clinicSignIn = siteHref("clinic", "/iniciar-sesion");

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Static content built here, not user input; `<` is escaped anyway.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c"),
        }}
      />
      <LandingShell>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 md:grid-cols-[1.15fr_1fr] md:pt-24">
          <div className="flex flex-col">
            <p className="etiqueta">Expediente clínico compartido</p>
            <h1 className="mt-3 font-display text-5xl leading-[0.95] font-medium text-balance sm:text-7xl">
              El expediente de tu mascota, siempre con vos.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Vacunas, consultas y carné digital en un solo lugar. El expediente es tuyo:
              las clínicas veterinarias lo consultan y lo completan solo con tu permiso.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href={install}
                className={cn(
                  buttonVariants({ variant: "solido" }),
                  "h-12 px-6 text-base",
                )}
              >
                Crear mi cuenta gratis
              </a>
              <a
                href={clinics}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-12 px-6 text-base",
                )}
              >
                Soy una clínica
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Gratis para dueños. Te toma unos 2 minutos.
            </p>
          </div>
          <CardPreview />
        </section>

        {/* Principles */}
        <section className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-3">
            <Principle icon={ShieldCheck} title="Es tuyo">
              El expediente pertenece al dueño, no a la clínica. Lo llevás a donde vayas.
            </Principle>
            <Principle icon={KeyRound} title="Con tu permiso">
              Cada clínica ve y registra solo lo que autorizás, y podés revocarlo cuando
              quieras.
            </Principle>
            <Principle icon={CalendarCheck} title="Hecho para Costa Rica">
              Avisos calculados con el esquema de vacunación nacional y lo que registró
              cada clínica.
            </Principle>
          </div>
        </section>

        {/* Owners */}
        <section id="duenos" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <SectionHeading label="Para dueños" title="Todo lo de tu mascota, ordenado" />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={QrCode} title="Carné digital con QR">
              Mostralo en la clínica o en un viaje: cualquiera puede verificarlo con el
              código.
            </Feature>
            <Feature icon={BellRing} title="Avisos a tiempo">
              Te recordamos vacunas y desparasitaciones antes de que venzan.
            </Feature>
            <Feature icon={ClipboardList} title="Expediente completo">
              Consultas, tratamientos, exámenes y alimentación en una sola línea de
              tiempo.
            </Feature>
            <Feature icon={Scale} title="Peso y crecimiento">
              Seguí la evolución de su peso con cada control.
            </Feature>
            <Feature icon={KeyRound} title="Permisos por clínica">
              Decidí qué clínica puede ver y registrar, y por cuánto tiempo.
            </Feature>
            <Feature icon={PawPrint} title="Varias mascotas">
              Cada una con su expediente, su esquema y su carné.
            </Feature>
          </div>
        </section>

        {/* Clinics */}
        <section id="clinicas" className="scroll-mt-24 border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2">
            <div>
              <SectionHeading
                label="Para clínicas"
                title="El historial de tus pacientes, sin papeles"
              />
              <p className="mt-6 text-muted-foreground">
                Consultá el historial que trae cada dueño y registrá el acto médico en el
                mismo expediente. Vos sumás información; el dueño la conserva.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={clinics}
                  className={cn(buttonVariants({ variant: "solido" }), "h-11 px-5")}
                >
                  Solicitar acceso
                </a>
                <a
                  href={clinicSignIn}
                  className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}
                >
                  Ya tengo cuenta
                </a>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {[
                {
                  icon: Stethoscope,
                  title: "Pacientes con permiso",
                  text: "Ves el expediente completo de quien te autorizó.",
                },
                {
                  icon: CalendarCheck,
                  title: "Vacunas vencidas",
                  text: "Una lista de quién necesita volver, sin hojas de cálculo.",
                },
                {
                  icon: KeyRound,
                  title: "Código de vinculación",
                  text: "El dueño ingresa tu código y queda conectado en segundos.",
                },
                {
                  icon: Building2,
                  title: "Clínica verificada",
                  text: "Revisamos cada clínica antes de habilitarla.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4 py-5">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span>
                    <span className="block font-display text-2xl leading-tight">
                      {title}
                    </span>
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Plans */}
        <section id="planes" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <SectionHeading label="Planes" title="Empezá gratis" />
          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            <PlanGroup title="Dueños" plans={OWNER_PLANS} />
            <PlanGroup title="Clínicas" plans={CLINIC_PLANS} />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Precios en colones. Los planes marcados como &ldquo;pronto&rdquo; todavía no
            están disponibles.
          </p>
        </section>

        {/* Closing call to action */}
        <section className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-20 md:flex-row md:items-end">
            <h2 className="font-display text-5xl leading-none font-medium text-balance md:flex-1">
              Su historia clínica merece un lugar seguro.
            </h2>
            <a
              href={install}
              className={cn(buttonVariants({ variant: "solido" }), "h-12 px-6 text-base")}
            >
              Crear mi cuenta gratis
            </a>
          </div>
        </section>
      </LandingShell>
    </>
  );
}

function Principle({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-l border-primary/60 pl-5">
      <Icon className="size-6 text-primary" strokeWidth={1.25} aria-hidden />
      <h3 className="font-display text-3xl leading-none">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 bg-background p-7">
      <span className="flex size-11 items-center justify-center rounded-full border border-primary text-primary">
        <Icon className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="font-display text-2xl leading-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function PlanGroup({ title, plans }: { title: string; plans: Plan[] }) {
  return (
    <div>
      <h3 className="etiqueta">{title}</h3>
      <ul className="mt-4 flex flex-col divide-y divide-border border-y border-border">
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-col gap-2 py-5">
            <span className="flex items-baseline gap-3">
              <span className="flex-1 font-display text-3xl leading-none">
                {plan.name}
              </span>
              {!plan.available && <span className="etiqueta !text-primary">Pronto</span>}
              <span className="font-display text-3xl leading-none text-primary">
                {plan.price}
              </span>
              <span className="w-16 text-xs text-muted-foreground">{plan.period}</span>
            </span>
            <span className="text-sm text-muted-foreground">{plan.summary}</span>
            <span className="flex flex-wrap gap-x-5 gap-y-1">
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
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A still of the digital card, drawn with the app's own styles. */
function CardPreview() {
  const vaccines = [
    { name: "Rabia", state: "Al día", date: "12 mar 2027" },
    { name: "Polivalente (DHPP)", state: "Al día", date: "04 ene 2027" },
    { name: "Desparasitación", state: "Pronto", date: "20 nov 2026" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <div className="absolute -inset-4 -z-10 rotate-3 rounded-[2rem] border border-primary/30" />
      <article className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.35)]">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full border border-primary font-display text-3xl text-primary">
            L
          </span>
          <div className="flex-1">
            <p className="etiqueta">Carné de vacunación</p>
            <p className="font-display text-3xl leading-none">Luna</p>
            <p className="text-sm text-muted-foreground">Perra · 3 años · esterilizada</p>
          </div>
        </div>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {vaccines.map((v) => (
            <li key={v.name} className="flex items-baseline gap-3 py-3 text-sm">
              <span className="flex-1">{v.name}</span>
              <span
                className={
                  v.state === "Pronto"
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }
              >
                {v.state}
              </span>
              <span className="w-24 text-right font-mono text-xs text-muted-foreground">
                {v.date}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <QrCode className="size-16 text-foreground" strokeWidth={1} />
          <p className="text-sm text-muted-foreground">
            Escaneá para verificar el carné con la clínica que lo registró.
          </p>
        </div>
      </article>
    </div>
  );
}
