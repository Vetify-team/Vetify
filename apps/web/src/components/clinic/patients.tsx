"use client";

import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { ScreenTitle } from "@/components/system";
import { usePets } from "@/hooks/usePets";
import { age } from "@/lib/format";
import { speciesLabel } from "@/lib/labels";

/** The clinic's patients: the API already filters by active permission. */
export function Patients() {
  const { data, error, isPending, refetch } = usePets();

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle
        label={
          data
            ? `${data.length} ${data.length === 1 ? "paciente" : "pacientes"} con expediente compartido`
            : "Pacientes"
        }
        title="Pacientes"
      />
      {isPending ? (
        <LoadingList />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty title="Todavía no tenés pacientes.">
          <p className="max-w-md text-sm text-muted-foreground">
            Un paciente aparece acá cuando su dueño escribe el código de vinculación de tu
            clínica en su app.
          </p>
        </Empty>
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
            {data.map((pet) => (
              <tr key={pet.id} className="border-b border-border hover:bg-muted/50">
                <td className="py-3">
                  <Link
                    href={`/pacientes/${pet.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {pet.name}
                    {pet.breed && (
                      <span className="text-muted-foreground"> · {pet.breed}</span>
                    )}
                  </Link>
                </td>
                <td className="py-3 text-muted-foreground">
                  {speciesLabel[pet.species]}
                </td>
                <td className="hidden py-3 text-muted-foreground sm:table-cell">
                  {age(pet.birthDate) ?? "—"}
                </td>
                <td className="hidden py-3 font-mono text-xs text-muted-foreground md:table-cell">
                  {pet.microchip ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
