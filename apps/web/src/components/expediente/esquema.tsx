"use client";

import type { EstadoVacunacion, VacunaDelEsquema } from "@vetify/types";
import { CalendarPlus } from "lucide-react";
import { CargandoLista, ErrorCarga, Vacio } from "@/components/estados";
import { EstadoTexto, Fila, Seccion } from "@/components/sistema";
import { Button } from "@/components/ui/button";
import { useAvisos, useVacunacion } from "@/hooks/useExpediente";
import { descargarIcs } from "@/lib/calendario";
import { fecha } from "@/lib/formato";

const detalleVacuna = (v: VacunaDelEsquema) => {
  if (v.estado === "vencida")
    return `Venció ${fecha(v.fechaVencimiento)} · refuerzo anual`;
  if (v.ultimaAplicacion)
    return `Aplicada ${fecha(v.ultimaAplicacion)} · vence ${fecha(v.fechaVencimiento)}`;
  if (v.estado === "no_aplica_aun") return `Corresponde desde ${fecha(v.proximaFecha)}`;
  return "Sin aplicar";
};

/** Filas de vacunas y desparasitaciones agrupadas por si requieren acción. */
function grupos(estado: EstadoVacunacion) {
  const filas = [
    ...estado.vacunas.map((v) => ({
      clave: `v-${v.vacuna}`,
      nombre: v.vacuna,
      detalle: detalleVacuna(v),
      estado: v.estado,
      fecha: v.estado === "vencida" ? null : (v.proximaFecha ?? v.fechaVencimiento),
    })),
    ...estado.desparasitaciones.map((d) => ({
      clave: `d-${d.tipo}`,
      nombre: d.tipo ? `Desparasitación ${d.tipo}` : "Desparasitación",
      detalle: d.proximaFecha
        ? `${d.estado === "vencida" ? "Venció" : "Vence"} ${fecha(d.proximaFecha)}${d.producto ? ` · ${d.producto}` : ""}`
        : `Aplicada ${fecha(d.ultimaAplicacion)}`,
      estado: d.estado,
      fecha: d.estado === "vencida" ? null : d.proximaFecha,
    })),
  ];
  return {
    accion: filas.filter((f) =>
      ["vencida", "pendiente", "por_vencer"].includes(f.estado),
    ),
    vigente: filas.filter((f) => f.estado === "vigente"),
    futuro: filas.filter((f) => f.estado === "no_aplica_aun"),
  };
}

/** Esquema de vacunación y desparasitación de una mascota. */
export function Esquema({
  mascotaId,
  nombre,
  compacto,
}: {
  mascotaId: string;
  nombre: string;
  compacto?: boolean;
}) {
  const { data, error, isPending, refetch } = useVacunacion(mascotaId);
  const avisos = useAvisos();

  if (isPending) return <CargandoLista filas={3} />;
  if (error) return <ErrorCarga error={error} reintentar={() => void refetch()} />;
  if (!data.vacunas.length && !data.desparasitaciones.length) {
    return <Vacio titulo="No hay un esquema de vacunación para esta especie todavía." />;
  }

  const g = grupos(data);
  const avisosMascota =
    avisos.data?.filter((a) => a.mascotaId === mascotaId && a.fecha) ?? [];
  const lista = (filas: typeof g.accion) =>
    filas.map((f) => (
      <Fila
        key={f.clave}
        titulo={f.nombre}
        detalle={f.detalle}
        derecha={<EstadoTexto estado={f.estado} fecha={f.fecha} />}
      />
    ));

  return (
    <div className="flex flex-col gap-8">
      {g.accion.length > 0 && (
        <Seccion titulo="Requiere acción">{lista(g.accion)}</Seccion>
      )}
      {g.vigente.length > 0 && (
        <Seccion
          titulo="Vigente"
          extra={compacto ? undefined : `Cobertura del esquema ${data.cobertura} %`}
        >
          {lista(g.vigente)}
        </Seccion>
      )}
      {g.futuro.length > 0 && (
        <Seccion titulo="Aún no corresponde">{lista(g.futuro)}</Seccion>
      )}

      {!compacto && avisosMascota.length > 0 && (
        <Button
          onClick={() =>
            descargarIcs(avisosMascota, `vetify-${nombre.toLowerCase()}.ics`)
          }
        >
          <CalendarPlus /> Agregar al calendario
        </Button>
      )}
    </div>
  );
}
