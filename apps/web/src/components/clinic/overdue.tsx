"use client";

import Link from "next/link";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { ScreenTitle, VaccineStatusText } from "@/components/system";
import { useAlerts } from "@/hooks/useRecord";
import { dewormingLabel, formatDate } from "@/lib/format";

/**
 * Adherence: patients with overdue or due doses. The reason a clinic pays
 * the subscription: knowing whom to call.
 */
export function Overdue() {
  const { data, error, isPending, refetch } = useAlerts();
  const overdue = data?.filter((a) => a.status === "expired" || a.status === "due") ?? [];
  const patients = new Set(overdue.map((a) => a.petId)).size;

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle
        label={
          data
            ? `${patients} ${patients === 1 ? "paciente" : "pacientes"} · ${overdue.length} dosis`
            : "Adherencia"
        }
        title="Esquemas vencidos"
        description="Dosis vencidas o que ya corresponden y no se han aplicado, entre tus pacientes con permiso activo."
      />
      {isPending ? (
        <LoadingList />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : overdue.length === 0 ? (
        <Empty title="Todos tus pacientes están al día." />
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
            {overdue.map((a) => (
              <tr
                key={`${a.petId}-${a.kind}-${a.name}`}
                className="border-b border-border"
              >
                <td className="py-3">
                  <Link
                    href={`/pacientes/${a.petId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {a.petName}
                  </Link>
                </td>
                <td className="py-3">
                  {a.kind === "deworming" ? dewormingLabel(a.name) : a.name}
                </td>
                <td className="hidden py-3 text-muted-foreground sm:table-cell">
                  {a.dueOn ? formatDate(a.dueOn) : "Nunca aplicada"}
                </td>
                <td className="py-3 text-right">
                  <VaccineStatusText status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
