"use client";

import Link from "next/link";
import { CargandoLista, ErrorCarga, Vacio } from "@/components/estados";
import { TituloPantalla } from "@/components/sistema";
import { useMascotas } from "@/hooks/useMascotas";
import { edad, nombreEspecie } from "@/lib/formato";

/** Pacientes de la clínica: el API ya filtra por permiso activo. */
export function Pacientes() {
  const { data, error, isPending, refetch } = useMascotas();

  return (
    <div className="flex flex-col gap-8">
      <TituloPantalla
        etiqueta={
          data
            ? `${data.length} ${data.length === 1 ? "paciente" : "pacientes"} con expediente compartido`
            : "Pacientes"
        }
        titulo="Pacientes"
      />
      {isPending ? (
        <CargandoLista />
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => void refetch()} />
      ) : data.length === 0 ? (
        <Vacio titulo="Todavía no tenés pacientes.">
          <p className="max-w-md text-sm text-muted-foreground">
            Un paciente aparece acá cuando su dueño le da acceso a tu clínica desde
            Vetify.
          </p>
        </Vacio>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="etiqueta border-b border-filete text-left">
              <th className="py-2 font-normal">Paciente</th>
              <th className="py-2 font-normal">Especie</th>
              <th className="hidden py-2 font-normal sm:table-cell">Edad</th>
              <th className="hidden py-2 font-normal md:table-cell">Microchip</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-muted/50">
                <td className="py-3">
                  <Link
                    href={`/pacientes/${m.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {m.nombre}
                    {m.raza && <span className="text-muted-foreground"> · {m.raza}</span>}
                  </Link>
                </td>
                <td className="py-3 text-muted-foreground">{nombreEspecie[m.especie]}</td>
                <td className="hidden py-3 text-muted-foreground sm:table-cell">
                  {edad(m.fechaNacimiento) ?? "—"}
                </td>
                <td className="hidden py-3 font-mono text-xs text-muted-foreground md:table-cell">
                  {m.microchip ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
