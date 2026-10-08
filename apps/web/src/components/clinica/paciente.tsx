"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CargandoLista, ErrorCarga } from "@/components/estados";
import { Esquema } from "@/components/expediente/esquema";
import { Historial } from "@/components/expediente/historial";
import { AccionesClinica } from "@/components/expediente/registros-clinica";
import { SeriePeso } from "@/components/expediente/serie-peso";
import { Etiqueta, Fila, Seccion } from "@/components/sistema";
import { useExpediente } from "@/hooks/useExpediente";
import { useMascota } from "@/hooks/useMascotas";
import { fecha, nombreEspecie } from "@/lib/formato";

/** Expediente compartido visto desde la clínica: historial a la izquierda, esquema y peso a la derecha. */
export function Paciente({ id }: { id: string }) {
  const mascota = useMascota(id);
  const expediente = useExpediente(id);

  if (mascota.isPending) return <CargandoLista filas={4} />;
  if (mascota.error)
    return <ErrorCarga error={mascota.error} reintentar={() => void mascota.refetch()} />;

  const m = mascota.data;
  const meta = [
    m.raza ?? nombreEspecie[m.especie],
    [
      m.sexo === "macho" ? "Macho" : m.sexo === "hembra" ? "Hembra" : null,
      m.esterilizado ? "esterilizado" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    m.fechaNacimiento && `Nac. ${fecha(m.fechaNacimiento)}`,
    m.microchip && `Chip ${m.microchip}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/pacientes"
        className="-mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Pacientes
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <Etiqueta>Expediente compartido · permiso de escritura</Etiqueta>
          <h1 className="font-display text-5xl font-medium">{m.nombre}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            {meta.map((dato) => (
              <span key={dato as string}>{dato}</span>
            ))}
          </p>
        </div>
        <AccionesClinica mascotaId={id} />
      </header>

      <div className="grid gap-10 xl:grid-cols-[1.4fr_1fr]">
        {expediente.isPending ? (
          <CargandoLista filas={5} />
        ) : expediente.error ? (
          <ErrorCarga
            error={expediente.error}
            reintentar={() => void expediente.refetch()}
          />
        ) : (
          <Historial expediente={expediente.data} />
        )}

        <aside className="flex flex-col gap-10 xl:border-l xl:border-border xl:pl-10">
          <div className="flex flex-col gap-3">
            <Etiqueta>Esquema</Etiqueta>
            <Esquema mascotaId={id} nombre={m.nombre} compacto />
          </div>
          <div className="flex flex-col gap-3">
            <Etiqueta>Peso</Etiqueta>
            <SeriePeso mascotaId={id} puedeRegistrar={false} />
          </div>
          {expediente.data && expediente.data.examenes.length > 0 && (
            <Seccion titulo="Exámenes">
              {expediente.data.examenes.map((x) => (
                <Fila
                  key={x.id}
                  titulo={x.tipo ?? "Examen"}
                  derecha={
                    <span className="text-xs text-muted-foreground">
                      {fecha(x.fecha)}
                    </span>
                  }
                />
              ))}
            </Seccion>
          )}
        </aside>
      </div>
    </div>
  );
}
