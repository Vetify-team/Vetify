"use client";

import Link from "next/link";
import { CargandoLista, ErrorCarga, Vacio } from "@/components/estados";
import { EstadoTexto, TituloPantalla } from "@/components/sistema";
import { useAvisos } from "@/hooks/useExpediente";
import { fecha } from "@/lib/formato";

/**
 * Adherencia: pacientes con dosis vencidas o pendientes. Es la razón por la que
 * la clínica paga la suscripción: saber a quién llamar.
 */
export function Vencidos() {
  const { data, error, isPending, refetch } = useAvisos();
  const vencidos =
    data?.filter((a) => a.estado === "vencida" || a.estado === "pendiente") ?? [];
  const pacientes = new Set(vencidos.map((a) => a.mascotaId)).size;

  return (
    <div className="flex flex-col gap-8">
      <TituloPantalla
        etiqueta={
          data
            ? `${pacientes} ${pacientes === 1 ? "paciente" : "pacientes"} · ${vencidos.length} dosis`
            : "Adherencia"
        }
        titulo="Esquemas vencidos"
        descripcion="Dosis vencidas o que ya corresponden y no se han aplicado, entre tus pacientes con permiso activo."
      />
      {isPending ? (
        <CargandoLista />
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => void refetch()} />
      ) : vencidos.length === 0 ? (
        <Vacio titulo="Todos tus pacientes están al día." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="etiqueta border-b border-filete text-left">
              <th className="py-2 font-normal">Paciente</th>
              <th className="py-2 font-normal">Dosis pendiente</th>
              <th className="hidden py-2 font-normal sm:table-cell">Venció</th>
              <th className="py-2 text-right font-normal">Estado</th>
            </tr>
          </thead>
          <tbody>
            {vencidos.map((a) => (
              <tr key={`${a.mascotaId}-${a.nombre}`} className="border-b border-border">
                <td className="py-3">
                  <Link
                    href={`/pacientes/${a.mascotaId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {a.mascotaNombre}
                  </Link>
                </td>
                <td className="py-3">{a.nombre}</td>
                <td className="hidden py-3 text-muted-foreground sm:table-cell">
                  {a.fecha ? fecha(a.fecha) : "Nunca aplicada"}
                </td>
                <td className="py-3 text-right">
                  <EstadoTexto estado={a.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
