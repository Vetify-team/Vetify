"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { OwnerPageSkeleton } from "@/components/owner/owner-page-skeleton";
import { LoadError } from "@/components/states";
import { VaccineStatusText } from "@/components/system";
import { usePet } from "@/hooks/usePets";
import { useVaccinationStatus } from "@/hooks/useRecord";
import { formatDate } from "@/lib/format";
import { dewormingLabel } from "@/lib/labels";
import { recordedVaccines } from "@/lib/vaccination";
import { cn } from "cn";
import { PetAvatar } from "./pet-photo";
import { describePet } from "./pet-utils";
import { PetScreen } from "./pet-screen";
import { PublicCardLink } from "./public-card-link";

const card =
  "rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] dark:shadow-none dark:ring-1 dark:ring-border";

/** The vaccination card, and its public QR managed by the owner. */
export function VaccinationCard({ id }: { id: string }) {
  const status = useVaccinationStatus(id);
  const pet = usePet(id);
  const link = useQuery({
    queryKey: ["card-link", id],
    queryFn: () => api.cardLink(id),
    retry: false,
  });

  return (
    <PetScreen
      id={id}
      back={{ href: `/mascotas/${id}`, text: "Panel" }}
      pending={status.isPending || link.isPending}
      loading={
        <OwnerPageSkeleton
          page="card"
          hasQr={Boolean(link.data?.token)}
          schedule={status.data}
          hasMicrochip={Boolean(pet.data?.microchip)}
        />
      }
    >
      {(pet) => (
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-4xl leading-tight font-medium">
            Carné de vacunación
          </h1>

          <article className={cn(card, "overflow-hidden")}>
            <header className="flex items-center gap-4 bg-primary px-5 py-4 text-primary-foreground">
              <PetAvatar
                pet={pet}
                size="md"
                className="ring-2 ring-primary-foreground/40"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-3xl leading-tight">{pet.name}</p>
                <p className="truncate text-sm text-primary-foreground/80">
                  {describePet(pet)}
                </p>
              </div>
              <span className="font-display text-lg">Vetify</span>
            </header>

            {status.isError ? (
              <div className="p-5">
                <LoadError error={status.error} retry={() => void status.refetch()} />
              </div>
            ) : (
              <dl className="flex flex-col divide-y divide-border/70 px-5 py-2 text-sm">
                {status.data && recordedVaccines(status.data).length === 0 && (
                  <p className="py-4 text-muted-foreground">
                    Todavía no hay vacunas registradas por una clínica.
                  </p>
                )}
                {status.data &&
                  recordedVaccines(status.data).map((v) => (
                    <div
                      key={v.vaccine}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <dt className="min-w-0">
                        <span className="block font-medium">{v.vaccine}</span>
                        <span className="block text-xs text-muted-foreground">
                          {v.expiresOn
                            ? `${v.status === "expired" ? "Venció" : "Vence"} ${formatDate(v.expiresOn)}`
                            : `Aplicada ${formatDate(v.lastAppliedOn)}`}
                        </span>
                      </dt>
                      <dd>
                        <VaccineStatusText status={v.status} date={v.expiresOn} />
                      </dd>
                    </div>
                  ))}
                {status.data?.dewormings
                  .filter((d) => d.nextDueOn)
                  .map((d) => (
                    <div
                      key={d.kind}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <dt className="min-w-0">
                        <span className="block font-medium">
                          {dewormingLabel(d.kind)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Próxima {formatDate(d.nextDueOn)}
                        </span>
                      </dt>
                      <dd>
                        <VaccineStatusText status={d.status} date={d.nextDueOn} />
                      </dd>
                    </div>
                  ))}
                {pet.microchip && (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="font-medium">Microchip</dt>
                    <dd className="font-mono">{pet.microchip}</dd>
                  </div>
                )}
              </dl>
            )}
          </article>

          <section aria-label="QR público" className={cn(card, "p-5 sm:p-7")}>
            <PublicCardLink pet={pet} />
          </section>
        </div>
      )}
    </PetScreen>
  );
}
