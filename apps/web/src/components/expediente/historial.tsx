"use client";

import type { Expediente } from "@vetify/types";
import { Seccion } from "@/components/sistema";
import { fecha } from "@/lib/formato";

interface Entrada {
  id: string;
  fecha: string;
  titulo: string;
  detalle: string;
}

const unir = (...partes: (string | null | undefined | false)[]) =>
  partes.filter(Boolean).join(" · ");

/** Todo lo que le pasó a la mascota, de todas las clínicas y del dueño, por fecha. */
export function entradasDelHistorial(e: Expediente): Entrada[] {
  const clinica = (id: string | null) => e.clinicas.find((c) => c.id === id)?.nombre;
  const veterinario = (id: string | null) =>
    e.veterinarios.find((v) => v.id === id)?.nombre;

  const entradas: Entrada[] = [
    ...e.consultas.map((c) => ({
      id: c.id,
      fecha: c.fecha.slice(0, 10),
      titulo: c.motivo ?? "Consulta",
      detalle: unir(veterinario(c.veterinarioId), clinica(c.clinicaId), c.diagnostico),
    })),
    ...e.vacunas.map((v) => ({
      id: v.id,
      fecha: v.fechaAplicacion,
      titulo: `Vacuna: ${v.tipo}`,
      detalle: unir(
        clinica(v.clinicaId),
        v.lote && `lote ${v.lote}`,
        v.fechaVencimiento && `vence ${fecha(v.fechaVencimiento)}`,
      ),
    })),
    ...e.desparasitaciones.map((d) => ({
      id: d.id,
      fecha: d.fecha,
      titulo: d.tipo ? `Desparasitación ${d.tipo}` : "Desparasitación",
      detalle: unir(d.producto, d.proximaFecha && `próxima ${fecha(d.proximaFecha)}`),
    })),
    ...e.tratamientos.map((t) => ({
      id: t.id,
      fecha: t.inicio ?? "",
      titulo: t.descripcion,
      detalle: unir("Tratamiento", t.fin && `hasta ${fecha(t.fin)}`),
    })),
    ...e.examenes.map((x) => ({
      id: x.id,
      fecha: x.fecha,
      titulo: x.tipo ? `Examen: ${x.tipo}` : "Examen",
      detalle: unir(x.resultado),
    })),
    ...e.registrosPeso.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      titulo: "Control de peso",
      detalle: `${p.pesoKg.toLocaleString("es-CR")} kg · dueño`,
    })),
    ...e.registrosAlimentacion.map((a) => ({
      id: a.id,
      fecha: a.fecha,
      titulo: a.detalle ?? "Observación",
      detalle: "Observación del dueño",
    })),
  ];

  return entradas.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const fechaCorta = new Intl.DateTimeFormat("es-CR", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** Línea de tiempo del expediente compartido. */
export function Historial({ expediente }: { expediente: Expediente }) {
  const entradas = entradasDelHistorial(expediente);
  const clinicas = expediente.clinicas.length;

  return (
    <Seccion
      titulo="Historial completo"
      extra={`${clinicas} ${clinicas === 1 ? "clínica" : "clínicas"} · ${entradas.length} registros`}
    >
      {entradas.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Todavía no hay registros. Lo que anoten las clínicas y vos aparece acá.
        </p>
      ) : (
        <ol>
          {entradas.map((e) => (
            <li key={e.id} className="fila grid grid-cols-[4.5rem_1fr] gap-3">
              <time dateTime={e.fecha} className="pt-0.5 text-xs text-muted-foreground">
                {e.fecha ? fechaCorta.format(new Date(`${e.fecha}T00:00:00Z`)) : "—"}
              </time>
              <div className="min-w-0">
                <p>{e.titulo}</p>
                {e.detalle && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{e.detalle}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Seccion>
  );
}
