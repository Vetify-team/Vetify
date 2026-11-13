"use client";

import type { Pet } from "@vetify/types";
import {
  Building2,
  ChevronRight,
  FileText,
  QrCode,
  Scale,
  ShieldCheck,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { AssistantIcon } from "@/components/assistant/assistant-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAssistantPanel } from "@/hooks/useAssistantPanel";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";
import { ExportPdfButton } from "./export-pdf-button";
import {
  cardSurface,
  DewormingIndicator,
  Indicator,
  VaccineIndicator,
  WeightIndicator,
} from "./panel-parts";
import { PetPhoto } from "./pet-photo";
import { PetScreen } from "./pet-screen";
import { describePet } from "./pet-utils";

const card = cardSurface;

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
      <header
        className={cn(
          card,
          "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-5 p-5 sm:p-6",
        )}
      >
        <div className="sm:row-span-2">
          <PetPhoto pet={pet} editable size="xl" />
        </div>
        <div className="min-w-0 self-center sm:self-end">
          <h1 className="font-display text-5xl leading-none font-medium break-words sm:text-6xl">
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
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:col-start-2 sm:self-start">
          <Button
            variant="solido"
            className="rounded-full max-sm:w-full"
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
          <ExportPdfButton pet={pet} kind="record" label="PDF" />
        </div>
      </header>

      <Indicators pet={pet} />

      <nav aria-label="Expediente" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          href={`${base}/expediente`}
          icon={FileText}
          title="Historial"
          text="Consultas, vacunas, exámenes y lo que anotás vos"
        />
        <SectionCard
          href={`${base}/vacunas`}
          icon={Syringe}
          title="Esquema de vacunas"
          text="Vacunas y desparasitaciones al día"
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
          text="La vigencia, con QR para terceros"
        />
        <SectionCard
          href={`${base}/permisos`}
          icon={ShieldCheck}
          title="Quién puede verlo"
          text="Clínicas con acceso y la bitácora"
        />
      </nav>

      <section aria-labelledby="facts" className={cn(card, "p-6")}>
        <h2 id="facts" className="font-display text-2xl">
          Datos
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {facts.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{key}</dt>
              <dd className={cn("truncate", key === "Microchip" && "font-mono text-xs")}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/** Next vaccine, last weight with its trend, deworming and clinics with access. */
function Indicators({ pet }: { pet: Pet }) {
  const permissions = usePermissions(pet.id);
  const clinics = permissions.data?.filter((p) => p.status === "active") ?? [];
  const base = `/mascotas/${pet.id}`;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <VaccineIndicator petId={pet.id} href={`${base}/vacunas`} />
      <WeightIndicator petId={pet.id} href={`${base}/peso`} />
      <DewormingIndicator petId={pet.id} href={`${base}/vacunas`} />
      <Indicator href={`${base}/permisos`} icon={Building2} label="Clínicas con acceso">
        <span className="font-display text-3xl leading-none lining-nums">
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
