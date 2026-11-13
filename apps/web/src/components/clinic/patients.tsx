"use client";

import type { Alert, Pet } from "@vetify/types";
import {
  CalendarClock,
  ChevronRight,
  PawPrint,
  Scale,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { StatusPill } from "@/components/system";
import { PetAvatar } from "@/components/pets/pet-photo";
import { usePets } from "@/hooks/usePets";
import { useMyClinic } from "@/hooks/useClinic";
import { ScanButton } from "./scan-button";
import { useAlerts, useLatestWeightsOf } from "@/hooks/useRecord";
import { age, greeting, today } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";
import { statusLine, suddenWeightChange } from "@/lib/pet-summary";

/**
 * The clinic's patients (the API already filters by active permission). The
 * whole row opens the patient's file: a table-like list on desktop, cards on
 * a phone.
 */
export function Patients() {
  const { data, error, isPending, refetch } = usePets();
  const alerts = useAlerts();
  const clinic = useMyClinic();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-muted-foreground">
          {greeting()}
          {clinic.data && `, ${clinic.data.name}`}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
            Hoy
          </h1>
          <ScanButton />
        </div>
      </header>
      {data && <DayCards pets={data} alerts={alerts.data} />}
      <h2 id="pacientes" className="mt-2 scroll-mt-6 font-display text-3xl leading-tight">
        Pacientes{" "}
        {data && (
          <span className="font-sans text-base text-muted-foreground">
            ({data.length})
          </span>
        )}
      </h2>
      {isPending ? (
        <LoadingList />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty title="Todavía no tenés pacientes.">
          <p className="max-w-md text-sm text-muted-foreground">
            Un paciente aparece acá cuando su dueño escribe el código de vinculación de tu
            clínica en su app.
          </p>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2 md:gap-0 md:overflow-hidden md:rounded-3xl md:bg-card md:shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] md:dark:ring-1 md:dark:ring-border">
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_1.25rem] gap-4 border-b border-border/70 px-5 py-3 text-xs text-muted-foreground md:grid"
          >
            <span>Paciente</span>
            <span>Especie</span>
            <span>Edad</span>
            <span>Vacunas</span>
            <span />
          </div>
          <ul className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-border/70">
            {data.map((pet) => {
              const status = statusLine(
                alerts.data?.filter((a) => a.petId === pet.id) ?? [],
              );
              return (
                <li key={pet.id}>
                  <Link
                    href={`/pacientes/${pet.id}`}
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl bg-card p-3.5 shadow-[0_1px_2px_rgba(29,27,24,0.06)] transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_1.25rem] md:gap-4 md:rounded-none md:bg-transparent md:px-5 md:py-3 md:shadow-none"
                  >
                    <span className="row-span-2 flex min-w-0 items-center gap-3 md:row-span-1">
                      <PetAvatar pet={pet} size="sm" />
                      <span className="hidden min-w-0 md:block">
                        <span className="block truncate font-medium">{pet.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {pet.breed ?? "Sin raza registrada"}
                        </span>
                      </span>
                    </span>
                    {/* Phone: name and details next to the photo. */}
                    <span className="min-w-0 md:hidden">
                      <span className="block truncate font-medium">{pet.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[speciesLabel[pet.species], pet.breed, age(pet.birthDate)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="hidden text-sm text-muted-foreground md:block">
                      {speciesLabel[pet.species]}
                    </span>
                    <span className="hidden text-sm text-muted-foreground md:block">
                      {age(pet.birthDate) ?? "—"}
                    </span>
                    <span className="col-start-2 md:col-start-auto">
                      <StatusPill tone={status.tone}>{status.text}</StatusPill>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="col-start-3 row-span-2 row-start-1 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary md:col-start-auto md:row-span-1 md:row-start-auto"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const dayCard =
  "flex min-w-0 flex-col gap-2 rounded-3xl bg-card p-4 shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 dark:shadow-none dark:ring-1 dark:ring-border";

function DayCard({
  href,
  icon: Icon,
  tint,
  label,
  count,
  children,
}: {
  href: string;
  icon: LucideIcon;
  tint: string;
  label: string;
  count: number | string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={dayCard}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-xl", tint)}>
          <Icon className="size-4" strokeWidth={1.9} aria-hidden />
        </span>
      </span>
      <span className="font-display text-4xl leading-none lining-nums">{count}</span>
      {children && (
        <span className="line-clamp-2 text-xs text-muted-foreground">{children}</span>
      )}
    </Link>
  );
}

/**
 * The clinic's day at a glance: patients, vaccines overdue and about to
 * expire, and recent sudden weight changes. Each card opens where to act.
 */
function DayCards({ pets, alerts }: { pets: Pet[]; alerts: Alert[] | undefined }) {
  const weights = useLatestWeightsOf(pets.map((p) => p.id));
  const now = today();
  const overdue =
    alerts?.filter((a) => a.status === "expired" || a.status === "due") ?? [];
  const expiring = alerts?.filter((a) => a.status === "expiring") ?? [];
  const names = (list: { petName: string }[]) =>
    [...new Set(list.map((a) => a.petName))].join(", ");
  const changes = pets
    .slice(0, weights.length)
    .map((pet, i) => ({
      pet,
      change: weights[i]?.data ? suddenWeightChange(weights[i].data, now) : null,
    }))
    .filter((x): x is { pet: Pet; change: NonNullable<typeof x.change> } => !!x.change);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <DayCard
        href="#pacientes"
        icon={PawPrint}
        tint="bg-[#f1e3c6] text-[#7a5212]"
        label="Pacientes"
        count={pets.length}
      >
        Con expediente compartido
      </DayCard>
      <DayCard
        href="/vencidos"
        icon={Syringe}
        tint="bg-alert/12 text-alert"
        label="Vacunas vencidas"
        count={alerts ? overdue.length : "…"}
      >
        {overdue.length ? names(overdue) : "Nadie atrasado"}
      </DayCard>
      <DayCard
        href="/carnes"
        icon={CalendarClock}
        tint="bg-warn/14 text-warn"
        label="Por vencer"
        count={alerts ? expiring.length : "…"}
      >
        {expiring.length ? names(expiring) : "Nada en los próximos 30 días"}
      </DayCard>
      <DayCard
        href={changes[0] ? `/pacientes/${changes[0].pet.id}#peso` : "#pacientes"}
        icon={Scale}
        tint="bg-[#d6e2e9] text-[#2e4854]"
        label="Alertas de peso"
        count={changes.length}
      >
        {changes.length
          ? changes
              .map(
                ({ pet, change }) =>
                  `${pet.name} ${change.percent > 0 ? "+" : ""}${change.percent} %`,
              )
              .join(", ")
          : "Sin cambios bruscos recientes"}
      </DayCard>
    </div>
  );
}
