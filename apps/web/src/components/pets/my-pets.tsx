"use client";

import type { Alert, Pet } from "@vetify/types";
import { ChevronRight, Plus, Scale, Syringe } from "lucide-react";
import Link from "next/link";
import { OwnerPageSkeleton } from "@/components/owner/owner-page-skeleton";
import { LoadError } from "@/components/states";
import { StatusPill } from "@/components/system";
import { buttonVariants } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/useBilling";
import { usePets } from "@/hooks/usePets";
import { useAlerts, useLatestWeights } from "@/hooks/useRecord";
import { useSession } from "@/hooks/useSession";
import { formatDate, greeting } from "@/lib/format";
import { formatChange, formatKg, latestWeight, nextDose } from "@/lib/pet-summary";
import { FREE_PLAN_LIMIT } from "@/lib/plans";
import { cn } from "cn";
import { PetAvatar } from "./pet-photo";
import { describePet } from "./pet-utils";

/** Owner's home: a card per pet that invites to open it, and a clear way to add one. */
export function MyPets() {
  const { user } = useSession();
  const pets = usePets();
  const alerts = useAlerts();
  const billing = useBillingStatus();
  // The limit only applies while payments are on (and Premium can be bought).
  const capped = billing.data?.enabled === true && billing.data.plan === "free";
  const firstName = user?.name.split(" ")[0] ?? "";

  if (pets.isPending || alerts.isPending)
    return <OwnerPageSkeleton page="pets" petCount={pets.data?.length} />;

  const add = (
    <Link
      href="/mascotas/nueva"
      data-tour="add-pet"
      className={cn(buttonVariants({ variant: "solido", size: "lg" }), "rounded-full")}
    >
      <Plus aria-hidden /> Agregar mascota
    </Link>
  );

  return (
    <div data-wide className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting()}
            {firstName && `, ${firstName}`}
          </p>
          <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
            Mis mascotas
          </h1>
        </div>
        {pets.data && pets.data.length > 0 && add}
      </header>

      {pets.error ? (
        <LoadError error={pets.error} retry={() => void pets.refetch()} />
      ) : pets.data.length === 0 ? (
        <div
          data-tour="pet-empty"
          className="flex flex-col items-start gap-4 rounded-3xl bg-card p-8 shadow-sm"
        >
          <p className="font-display text-3xl leading-tight">
            Todavía no registraste ninguna mascota.
          </p>
          <p className="max-w-prose text-muted-foreground">
            Empezá su expediente: es tuyo y la acompaña a cualquier veterinaria.
          </p>
          {add}
        </div>
      ) : (
        <>
          <ul data-tour="pet-list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pets.data.map((pet) => (
              <li key={pet.id}>
                <PetCard
                  pet={pet}
                  alerts={alerts.data?.filter((a) => a.petId === pet.id) ?? []}
                />
              </li>
            ))}
          </ul>
          {capped && pets.data.length >= FREE_PLAN_LIMIT && (
            <p className="-mt-4 text-sm text-muted-foreground">
              El plan gratuito cubre {FREE_PLAN_LIMIT} mascotas.{" "}
              <Link href="/ajustes" className="text-primary underline underline-offset-4">
                Premium las cubre todas
              </Link>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}

function PetCard({ pet, alerts }: { pet: Pet; alerts: Alert[] }) {
  const weights = useLatestWeights(pet.id);
  const dose = nextDose(alerts);
  const weight = weights.data ? latestWeight(weights.data) : null;
  const change = weight && formatChange(weight.change);

  return (
    <Link
      href={`/mascotas/${pet.id}`}
      className="group flex h-full flex-col gap-5 rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.06)] transition-all outline-none hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(29,27,24,0.08),0_14px_32px_rgba(29,27,24,0.1)] focus-visible:ring-3 focus-visible:ring-ring/50 dark:shadow-none dark:ring-1 dark:ring-border"
    >
      <div className="flex items-center gap-4">
        <PetAvatar pet={pet} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-3xl leading-tight font-medium">
            {pet.name}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{describePet(pet)}</p>
        </div>
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 rounded-2xl bg-background/70 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Syringe className="size-3.5" aria-hidden /> Vacunas
          </dt>
          <dd className="flex flex-col items-start gap-1">
            <StatusPill tone={dose.tone}>{dose.title}</StatusPill>
            <span className="text-xs text-muted-foreground">{dose.detail}</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-background/70 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Scale className="size-3.5" aria-hidden /> Último peso
          </dt>
          <dd className="flex flex-col gap-0.5">
            {weight ? (
              <>
                <span className="font-display text-2xl leading-none">
                  {formatKg(weight.kg)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(weight.recordedOn)}
                  {change && ` · ${change}`}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {weights.isPending ? "…" : "Sin registros"}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
