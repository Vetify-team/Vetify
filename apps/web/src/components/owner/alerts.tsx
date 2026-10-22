"use client";

import { CalendarPlus } from "lucide-react";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { Row, ScreenTitle, Section, VaccineStatusText } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/hooks/useRecord";
import { downloadIcs } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { alertLabel } from "@/lib/labels";

/** Everything upcoming or overdue, for every pet. */
export function Alerts() {
  const { data, error, isPending, refetch } = useAlerts();
  const action =
    data?.filter(
      (a) => a.status === "expired" || a.status === "due" || a.status === "expiring",
    ) ?? [];
  const upcoming =
    data?.filter((a) => a.status === "valid" || a.status === "not_yet_due") ?? [];
  const name = (a: NonNullable<typeof data>[number]) => alertLabel(a);

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle
        label="Recordatorios"
        title="Avisos"
        description="Calculados con el esquema de vacunación de Costa Rica y lo que registró cada clínica."
      />
      {isPending ? (
        <LoadingList />
      ) : error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty title="Nada pendiente.">
          <p className="text-sm text-muted-foreground">
            Cuando una vacuna se acerque a su vencimiento, aparece acá.
          </p>
        </Empty>
      ) : (
        <>
          {action.length > 0 && (
            <Section title="Requiere acción">
              {action.map((a) => (
                <Row
                  key={`${a.petId}-${a.kind}-${a.name}`}
                  href={`/mascotas/${a.petId}/vacunas`}
                  title={`${name(a)} de ${a.petName}`}
                  detail={a.dueOn ? formatDate(a.dueOn) : "Sin aplicar"}
                  right={
                    <VaccineStatusText
                      status={a.status}
                      date={a.status === "expired" ? null : a.dueOn}
                    />
                  }
                />
              ))}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="Próximos">
              {upcoming.map((a) => (
                <Row
                  key={`${a.petId}-${a.kind}-${a.name}`}
                  href={`/mascotas/${a.petId}/vacunas`}
                  title={`${name(a)} de ${a.petName}`}
                  detail={formatDate(a.dueOn)}
                  right={<VaccineStatusText status={a.status} date={a.dueOn} />}
                />
              ))}
            </Section>
          )}
          {data.some((a) => a.dueOn) && (
            <Button onClick={() => downloadIcs(data, "vetify-avisos.ics")}>
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
