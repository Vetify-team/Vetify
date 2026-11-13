"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { VaccineStatusText } from "@/components/system";
import { useAlerts } from "@/hooks/useRecord";
import { formatDate } from "@/lib/format";
import { alertLabel } from "@/lib/labels";

/**
 * Adherence: patients with overdue or due doses. The reason a clinic pays
 * the subscription: knowing whom to call. Each whole row opens the patient.
 */
export function Overdue() {
  const { data, error, isPending, refetch } = useAlerts();
  const overdue = data?.filter((a) => a.status === "expired" || a.status === "due") ?? [];
  const patients = new Set(overdue.map((a) => a.petId)).size;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
          Esquemas vencidos
        </h1>
        <p className="mt-1 max-w-prose text-muted-foreground">
          {data
            ? `${patients} ${patients === 1 ? "paciente" : "pacientes"} con ${overdue.length} ${overdue.length === 1 ? "dosis pendiente" : "dosis pendientes"}. `
            : ""}
          Dosis vencidas o que ya corresponden, entre tus pacientes con permiso activo.
        </p>
      </header>
      {isPending ? (
        <LoadingList />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : overdue.length === 0 ? (
        <Empty title="Todos tus pacientes están al día." />
      ) : (
        <ul className="flex flex-col gap-2 md:gap-0 md:divide-y md:divide-border/70 md:overflow-hidden md:rounded-3xl md:bg-card md:shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] md:dark:ring-1 md:dark:ring-border">
          {overdue.map((a) => (
            <li key={`${a.petId}-${a.kind}-${a.name}`}>
              <Link
                href={`/pacientes/${a.petId}`}
                className="group flex items-center gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(29,27,24,0.06)] transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 md:rounded-none md:bg-transparent md:px-5 md:shadow-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.petName}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {alertLabel(a)} ·{" "}
                    {a.dueOn ? `venció ${formatDate(a.dueOn)}` : "nunca aplicada"}
                  </span>
                </span>
                <VaccineStatusText status={a.status} />
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
