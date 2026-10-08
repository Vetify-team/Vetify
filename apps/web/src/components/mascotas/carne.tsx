"use client";

import { QrCode } from "lucide-react";
import { CargandoLista } from "@/components/estados";
import { Etiqueta, Inicial } from "@/components/sistema";
import { useVacunacion } from "@/hooks/useExpediente";
import { fecha } from "@/lib/formato";
import { descripcionMascota } from "./mascota-utiles";
import { PantallaMascota } from "./pantalla-mascota";

/**
 * Carné de vacunación. El QR verificable se arma con un token firmado por el
 * API (nunca en el cliente) y llega en la entrega final; el resto del carné
 * ya refleja la vigencia real.
 */
export function Carne({ id }: { id: string }) {
  const vacunacion = useVacunacion(id);

  return (
    <PantallaMascota id={id} volver={null}>
      {(m) => (
        <>
          <article className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <Etiqueta>Carné de vacunación</Etiqueta>
              <span className="font-display text-lg text-primary">Vetify</span>
            </div>

            <div className="mx-auto flex size-44 flex-col items-center justify-center gap-2 border border-dashed border-border text-center text-xs text-muted-foreground">
              <QrCode className="size-10" strokeWidth={1} aria-hidden />
              QR verificable
              <br />
              disponible en la entrega final
            </div>

            <div className="flex items-center gap-4 border-t border-border pt-5">
              <Inicial nombre={m.nombre} />
              <div>
                <p className="font-display text-2xl">{m.nombre}</p>
                <p className="text-xs text-muted-foreground">{descripcionMascota(m)}</p>
              </div>
            </div>

            {vacunacion.isPending ? (
              <CargandoLista filas={2} />
            ) : (
              <dl className="text-sm">
                {vacunacion.data?.vacunas
                  .filter((v) => v.ultimaAplicacion)
                  .map((v) => (
                    <div key={v.vacuna} className="fila flex justify-between gap-3">
                      <dt className="etiqueta self-center">{v.vacuna}</dt>
                      <dd
                        className={
                          v.estado === "vencida"
                            ? "border-b border-current font-semibold"
                            : undefined
                        }
                      >
                        {v.estado === "vencida"
                          ? "Vencida"
                          : `Vigente hasta ${fecha(v.fechaVencimiento)}`}
                      </dd>
                    </div>
                  ))}
                {vacunacion.data?.desparasitaciones
                  .filter((d) => d.proximaFecha)
                  .map((d) => (
                    <div key={d.tipo} className="fila flex justify-between gap-3">
                      <dt className="etiqueta self-center">Desparasitación</dt>
                      <dd>{fecha(d.proximaFecha)}</dd>
                    </div>
                  ))}
                {m.microchip && (
                  <div className="fila flex justify-between gap-3">
                    <dt className="etiqueta self-center">Microchip</dt>
                    <dd className="font-mono">{m.microchip}</dd>
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
    </PantallaMascota>
  );
}
