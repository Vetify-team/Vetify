"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { PublicCardLink } from "./public-card-link";
import { OwnerPageSkeleton } from "@/components/owner/owner-page-skeleton";
import { LoadError } from "@/components/states";
import { Initial, Label } from "@/components/system";
import { usePet } from "@/hooks/usePets";
import { useVaccinationStatus } from "@/hooks/useRecord";
import { formatDate } from "@/lib/format";
import { dewormingLabel } from "@/lib/labels";
import { describePet } from "./pet-utils";
import { PetScreen } from "./pet-screen";

/** Vaccination card and owner-managed public verification link. */
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
      back={null}
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
        <>
          <article className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <Label>Carné de vacunación</Label>
              <span className="font-display text-lg text-primary">Vetify</span>
            </div>

            <PublicCardLink petId={id} />

            <div className="flex items-center gap-4 border-t border-border pt-5">
              <Initial name={pet.name} />
              <div>
                <p className="font-display text-2xl">{pet.name}</p>
                <p className="text-xs text-muted-foreground">{describePet(pet)}</p>
              </div>
            </div>

            {status.isError ? (
              <LoadError error={status.error} retry={() => void status.refetch()} />
            ) : (
              <dl className="text-sm">
                {status.data?.vaccines
                  .filter((v) => v.lastAppliedOn)
                  .map((v) => (
                    <div key={v.vaccine} className="fila flex justify-between gap-3">
                      <dt className="etiqueta self-center">{v.vaccine}</dt>
                      <dd
                        className={
                          v.status === "expired"
                            ? "border-b border-current font-semibold"
                            : undefined
                        }
                      >
                        {v.status === "expired"
                          ? "Vencida"
                          : `Vigente hasta ${formatDate(v.expiresOn)}`}
                      </dd>
                    </div>
                  ))}
                {status.data?.dewormings
                  .filter((d) => d.nextDueOn)
                  .map((d) => (
                    <div key={d.kind} className="fila flex justify-between gap-3">
                      <dt className="etiqueta self-center">{dewormingLabel(d.kind)}</dt>
                      <dd>{formatDate(d.nextDueOn)}</dd>
                    </div>
                  ))}
                {pet.microchip && (
                  <div className="fila flex justify-between gap-3">
                    <dt className="etiqueta self-center">Microchip</dt>
                    <dd className="font-mono">{pet.microchip}</dd>
                  </div>
                )}
              </dl>
            )}
          </article>
          <p className="text-center text-xs text-muted-foreground">
            Hospedajes, guarderías y aerolíneas confirman la vigencia sin ver el
            expediente completo.
          </p>
        </>
      )}
    </PetScreen>
  );
}
