"use client";

import type { Pet } from "@vetify/types";
import {
  Building2,
  CalendarCheck,
  ChevronRight,
  FileText,
  Pill,
  QrCode,
  Scale,
  ShieldCheck,
  Syringe,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { AssistantIcon } from "@/components/assistant/assistant-icon";
import { StatusPill } from "@/components/system";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAssistantPanel } from "@/hooks/useAssistantPanel";
import { usePermissions } from "@/hooks/usePermissions";
import { useAlerts, useLatestWeights } from "@/hooks/useRecord";
import { formatDate } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";
import { formatChange, formatKg, latestWeight, nextDose } from "@/lib/pet-summary";
import { ExportPdfButton } from "./export-pdf-button";
import { PetPhoto } from "./pet-photo";
import { PetScreen } from "./pet-screen";
import { describePet } from "./pet-utils";

const card =
  "rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] dark:shadow-none dark:ring-1 dark:ring-border";

/**
 * A pet's panel: its photo and data up top, four indicators at a glance, and
 * a card per part of the record. Carné, PDF and the assistant are one tap away.
 */
export function PetProfile({ id }: { id: string }) {
  return (
    <PetScreen id={id} back={{ href: "/mascotas", text: "Mis mascotas" }}>
      {(pet) => <Panel pet={pet} />}
    </PetScreen>
  );
}

function Panel({ pet }: { pet: Pet }) {
  const showAssistant = useAssistantPanel((s) => s.show);
  const base = `/mascotas/${pet.id}`;
  const facts = [
    ["Especie", speciesLabel[pet.species]],
    ["Raza", pet.breed],
    ["Sexo", pet.sex === "male" ? "Macho" : pet.sex === "female" ? "Hembra" : null],
    ["Nacimiento", pet.birthDate ? formatDate(pet.birthDate) : null],
    ["Esterilizado", pet.neutered ? "Sí" : "No"],
    ["Microchip", pet.microchip],
  ].filter((d): d is [string, string] => !!d[1]);

  return (
    <div data-wide className="flex flex-col gap-6">
      <header className={cn(card, "flex flex-col gap-6 p-6 sm:flex-row sm:items-center")}>
        <PetPhoto pet={pet} editable size="xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <h1 className="font-display text-5xl leading-none font-medium sm:text-6xl">
              {pet.name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {[
                describePet(pet),
                pet.sex === "male" ? "Macho" : pet.sex === "female" ? "Hembra" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="solido"
              className="rounded-full"
              onClick={() => showAssistant(pet.id)}
            >
              <AssistantIcon className="size-4" /> Preguntale a Vetify
            </Button>
            <Link
              href={`${base}/carne`}
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
            >
              <QrCode aria-hidden /> Carné y QR
            </Link>
            <ExportPdfButton pet={pet} kind="record" label="PDF del expediente" />
          </div>
        </div>
      </header>

      <Indicators pet={pet} />

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <nav aria-label="Expediente" className="grid gap-3 sm:grid-cols-2">
          <SectionCard
            href={`${base}/expediente`}
            icon={FileText}
            title="Historial"
            text="Consultas, vacunas, tratamientos, exámenes y lo que anotás vos"
          />
          <SectionCard
            href={`${base}/vacunas`}
            icon={Syringe}
            title="Esquema de vacunas"
            text="Vacunas y desparasitaciones según su especie y edad"
          />
          <SectionCard
            href={`${base}/peso`}
            icon={Scale}
            title="Peso"
            text="La curva y el registro de hoy"
          />
          <SectionCard
            href={`${base}/carne`}
            icon={QrCode}
            title="Carné digital"
            text="Vigencia de vacunas para terceros, con QR"
          />
          <SectionCard
            href={`${base}/permisos`}
            icon={ShieldCheck}
            title="Quién puede verlo"
            text="Clínicas con acceso y la bitácora"
            className="sm:col-span-2"
          />
        </nav>

        <section aria-labelledby="facts" className={cn(card, "p-6")}>
          <h2 id="facts" className="font-display text-2xl">
            Datos
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {facts.map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{key}</dt>
                <dd
                  className={cn("truncate", key === "Microchip" && "font-mono text-xs")}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

/** Next vaccine, last weight with its trend, deworming and clinics with access. */
function Indicators({ pet }: { pet: Pet }) {
  const alerts = useAlerts();
  const weights = useLatestWeights(pet.id);
  const permissions = usePermissions(pet.id);
  const own = alerts.data?.filter((a) => a.petId === pet.id) ?? [];
  const vaccine = nextDose(own, "vaccination");
  const deworming = nextDose(own, "deworming");
  const weight = weights.data ? latestWeight(weights.data) : null;
  const change = weight && formatChange(weight.change);
  const clinics = permissions.data?.filter((p) => p.status === "active") ?? [];
  const base = `/mascotas/${pet.id}`;
  const Trend = weight?.change && weight.change < 0 ? TrendingDown : TrendingUp;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Indicator href={`${base}/vacunas`} icon={CalendarCheck} label="Próxima vacuna">
        <StatusPill tone={vaccine.tone}>{vaccine.title}</StatusPill>
        <span className="text-xs text-muted-foreground">
          {alerts.isPending ? "…" : vaccine.detail}
        </span>
      </Indicator>
      <Indicator href={`${base}/peso`} icon={Scale} label="Último peso">
        {weight ? (
          <>
            <span className="font-display text-3xl leading-none">
              {formatKg(weight.kg)}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {change && weight.change !== 0 && (
                <Trend className="size-3.5" aria-hidden />
              )}
              {change ?? formatDate(weight.recordedOn)}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            {weights.isPending ? "…" : "Sin registros"}
          </span>
        )}
      </Indicator>
      <Indicator href={`${base}/vacunas`} icon={Pill} label="Desparasitación">
        <StatusPill tone={deworming.tone}>{deworming.title}</StatusPill>
        <span className="text-xs text-muted-foreground">
          {alerts.isPending ? "…" : deworming.detail}
        </span>
      </Indicator>
      <Indicator href={`${base}/permisos`} icon={Building2} label="Clínicas con acceso">
        <span className="font-display text-3xl leading-none">
          {permissions.isPending ? "…" : clinics.length}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {clinics.length
            ? clinics.map((p) => p.clinic.name).join(", ")
            : "Ninguna por ahora"}
        </span>
      </Indicator>
    </div>
  );
}

function Indicator({
  href,
  icon: Icon,
  label,
  children,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        card,
        "flex min-w-0 flex-col gap-2 p-4 transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1.5">{children}</span>
    </Link>
  );
}

function SectionCard({
  href,
  icon: Icon,
  title,
  text,
  className,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  text: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        card,
        "group flex items-center gap-4 p-5 transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl leading-tight">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </Link>
  );
}
