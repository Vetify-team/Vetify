"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { StatusPill } from "@/components/system";
import { PetAvatar } from "@/components/pets/pet-photo";
import { usePets } from "@/hooks/usePets";
import { useAlerts } from "@/hooks/useRecord";
import { age } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";
import { statusLine } from "@/lib/pet-summary";

/**
 * The clinic's patients (the API already filters by active permission). The
 * whole row opens the patient's file: a table-like list on desktop, cards on
 * a phone.
 */
export function Patients() {
  const { data, error, isPending, refetch } = usePets();
  const alerts = useAlerts();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
          Pacientes
        </h1>
        {data && (
          <p className="mt-1 text-muted-foreground">
            {data.length} {data.length === 1 ? "paciente" : "pacientes"} con expediente
            compartido
          </p>
        )}
      </header>
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
