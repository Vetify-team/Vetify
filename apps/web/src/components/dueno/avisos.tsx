"use client";

import { CalendarPlus } from "lucide-react";
import { CargandoLista, ErrorCarga, Vacio } from "@/components/estados";
import { EstadoTexto, Fila, Seccion, TituloPantalla } from "@/components/sistema";
import { Button } from "@/components/ui/button";
import { useAvisos } from "@/hooks/useExpediente";
import { descargarIcs } from "@/lib/calendario";
import { fecha } from "@/lib/formato";

/** Todo lo que viene o está atrasado, de todas las mascotas. */
export function Avisos() {
  const { data, error, isPending, refetch } = useAvisos();

  const accion =
    data?.filter((a) => ["vencida", "pendiente", "por_vencer"].includes(a.estado)) ?? [];
  const proximos =
    data?.filter((a) => a.estado === "vigente" || a.estado === "no_aplica_aun") ?? [];

  return (
    <div className="flex flex-col gap-8">
      <TituloPantalla
        etiqueta="Recordatorios"
        titulo="Avisos"
        descripcion="Calculados con el esquema de vacunación de Costa Rica y lo que registró cada clínica."
      />
      {isPending ? (
        <CargandoLista />
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => void refetch()} />
      ) : data.length === 0 ? (
        <Vacio titulo="Nada pendiente.">
          <p className="text-sm text-muted-foreground">
            Cuando una vacuna se acerque a su vencimiento, aparece acá.
          </p>
        </Vacio>
      ) : (
        <>
          {accion.length > 0 && (
            <Seccion titulo="Requiere acción">
              {accion.map((a) => (
                <Fila
                  key={`${a.mascotaId}-${a.nombre}`}
                  href={`/mascotas/${a.mascotaId}/vacunas`}
                  titulo={`${a.nombre} de ${a.mascotaNombre}`}
                  detalle={a.fecha ? fecha(a.fecha) : "Sin aplicar"}
                  derecha={
                    <EstadoTexto
                      estado={a.estado}
                      fecha={a.estado === "vencida" ? null : a.fecha}
                    />
                  }
                />
              ))}
            </Seccion>
          )}
          {proximos.length > 0 && (
            <Seccion titulo="Próximos">
              {proximos.map((a) => (
                <Fila
                  key={`${a.mascotaId}-${a.nombre}`}
                  href={`/mascotas/${a.mascotaId}/vacunas`}
                  titulo={`${a.nombre} de ${a.mascotaNombre}`}
                  detalle={fecha(a.fecha)}
                  derecha={<EstadoTexto estado={a.estado} fecha={a.fecha} />}
                />
              ))}
            </Seccion>
          )}
          {data.some((a) => a.fecha) && (
            <Button onClick={() => descargarIcs(data, "vetify-avisos.ics")}>
              <CalendarPlus /> Agregar todo al calendario
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Las notificaciones al teléfono llegan en la entrega final; mientras tanto, el
            calendario te avisa tres días antes.
          </p>
        </>
      )}
    </div>
  );
}
