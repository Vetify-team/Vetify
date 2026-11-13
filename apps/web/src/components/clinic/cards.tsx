"use client";

import type { ClinicCard } from "@vetify/types";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { StatusPill, VaccineStatusText } from "@/components/system";
import { useClinicCards } from "@/hooks/useClinic";
import { formatDate } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";
import { cn } from "cn";

const card =
  "overflow-hidden rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] dark:shadow-none dark:ring-1 dark:ring-border";

/** A card's header: the whole of it opens the record when the clinic has full access. */
function Header({ card: c }: { card: ClinicCard }) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-2xl leading-tight">
          {c.name}
        </span>
        <span className="block text-sm text-muted-foreground">
          {speciesLabel[c.species]}
        </span>
      </span>
      {c.fullAccess ? (
        <span className="flex items-center gap-1 text-sm text-primary">
          Abrir expediente
          <ChevronRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      ) : (
        <StatusPill tone="muted">Solo carné</StatusPill>
      )}
    </>
  );
  const className = "flex items-center gap-3 border-b border-border/70 px-5 py-4";
  return c.fullAccess ? (
    <Link
      href={`/pacientes/${c.petId}`}
      className={cn(
        className,
        "group transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted",
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/**
 * Vaccination cards of every patient that shared at least its card. A pet
 * shared as "solo carné" appears only here; the rest open their record.
 */
export function ClinicCards() {
  const { data, error, isPending, refetch } = useClinicCards();
  const cardOnly = data?.filter((c) => !c.fullAccess).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
          Carnés
        </h1>
        <p className="mt-1 max-w-prose text-muted-foreground">
          {data
            ? `${data.length} ${data.length === 1 ? "carné" : "carnés"}, ${cardOnly} solo de carné. `
            : ""}
          Si el dueño compartió solo el carné, es lo único que ves de esa mascota.
        </p>
      </header>
      {isPending ? (
        <LoadingList />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty title="Todavía no tenés carnés.">
          <p className="text-muted-foreground">
            Aparecen cuando un dueño escribe el código de tu clínica, con permiso completo
            o solo de carné.
          </p>
        </Empty>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data.map((c) => (
            <li key={c.petId} className={card}>
              <Header card={c} />
              {c.vaccines.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  Sin vacunas registradas.
                </p>
              ) : (
                <dl className="divide-y divide-border/70 px-5">
                  {c.vaccines.map((v) => (
                    <div
                      key={v.vaccine}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <dt className="min-w-0">
                        <span className="block">{v.vaccine}</span>
                        <span className="block text-xs text-muted-foreground">
                          Aplicada {formatDate(v.lastAppliedOn)} · vence{" "}
                          {formatDate(v.expiresOn)}
                        </span>
                      </dt>
                      <dd>
                        <VaccineStatusText status={v.status} date={v.expiresOn} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
