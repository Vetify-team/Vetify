"use client";

import { QrCode } from "lucide-react";
import { LoadingList } from "@/components/states";
import { Initial, Label } from "@/components/system";
import { useVaccinationStatus } from "@/hooks/useRecord";
import { dewormingLabel, formatDate } from "@/lib/format";
import { describePet } from "./pet-utils";
import { PetScreen } from "./pet-screen";

/**
 * Vaccination card. The verifiable QR is built from a token signed by the
 * API (never by the client) and arrives in the final delivery; the rest of
 * the card already reflects the real validity.
 */
export function VaccinationCard({ id }: { id: string }) {
  const status = useVaccinationStatus(id);

  return (
    <PetScreen id={id} back={null}>
      {(pet) => (
        <>
          <article className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <Label>Carné de vacunación</Label>
              <span className="font-display text-lg text-primary">Vetify</span>
            </div>

            <div className="mx-auto flex size-44 flex-col items-center justify-center gap-2 border border-dashed border-border text-center text-xs text-muted-foreground">
              <QrCode className="size-10" strokeWidth={1} aria-hidden />
              QR verificable
              <br />
              disponible en la entrega final
            </div>

            <div className="flex items-center gap-4 border-t border-border pt-5">
              <Initial name={pet.name} />
              <div>
                <p className="font-display text-2xl">{pet.name}</p>
                <p className="text-xs text-muted-foreground">{describePet(pet)}</p>
              </div>
            </div>

            {status.isPending ? (
              <LoadingList rows={2} />
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
