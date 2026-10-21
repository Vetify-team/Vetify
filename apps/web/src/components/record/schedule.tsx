"use client";

import type { ScheduledVaccine, VaccinationStatus, VaccineStatus } from "@vetify/types";
import { CalendarPlus } from "lucide-react";
import { Empty, LoadError, LoadingList } from "@/components/states";
import { Row, Section, VaccineStatusText } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useAlerts, useVaccinationStatus } from "@/hooks/useRecord";
import { downloadIcs } from "@/lib/calendar";
import { dewormingLabel, formatDate } from "@/lib/format";

const vaccineDetail = (v: ScheduledVaccine) => {
  if (v.status === "expired") return `Venció ${formatDate(v.expiresOn)} · refuerzo anual`;
  if (v.lastAppliedOn)
    return `Aplicada ${formatDate(v.lastAppliedOn)} · vence ${formatDate(v.expiresOn)}`;
  if (v.status === "not_yet_due") return `Corresponde desde ${formatDate(v.nextDueOn)}`;
  return "Sin aplicar";
};

interface ScheduleRow {
  key: string;
  name: string;
  detail: string;
  status: VaccineStatus;
  date: string | null;
}

/** Vaccine and deworming rows grouped by whether they need action. */
function group(status: VaccinationStatus) {
  const rows: ScheduleRow[] = [
    ...status.vaccines.map((v) => ({
      key: `v-${v.vaccine}`,
      name: v.vaccine,
      detail: vaccineDetail(v),
      status: v.status,
      date: v.status === "expired" ? null : (v.nextDueOn ?? v.expiresOn),
    })),
    ...status.dewormings.map((d) => ({
      key: `d-${d.kind}`,
      name: dewormingLabel(d.kind),
      detail: d.nextDueOn
        ? `${d.status === "expired" ? "Venció" : "Vence"} ${formatDate(d.nextDueOn)}${d.product ? ` · ${d.product}` : ""}`
        : `Aplicada ${formatDate(d.lastAppliedOn)}`,
      status: d.status,
      date: d.status === "expired" ? null : d.nextDueOn,
    })),
  ];
  return {
    action: rows.filter(
      (r) => r.status === "expired" || r.status === "due" || r.status === "expiring",
    ),
    valid: rows.filter((r) => r.status === "valid"),
    later: rows.filter((r) => r.status === "not_yet_due"),
  };
}

/** Vaccination and deworming schedule of a pet. */
export function Schedule({
  petId,
  petName,
  compact,
}: {
  petId: string;
  petName: string;
  compact?: boolean;
}) {
  const { data, error, isPending, refetch } = useVaccinationStatus(petId);
  const alerts = useAlerts();

  if (isPending) return <LoadingList rows={3} />;
  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (!data.vaccines.length && !data.dewormings.length)
    return <Empty title="No hay un esquema de vacunación para esta especie todavía." />;

  const groups = group(data);
  const petAlerts = alerts.data?.filter((a) => a.petId === petId && a.dueOn) ?? [];
  const list = (rows: ScheduleRow[]) =>
    rows.map((r) => (
      <Row
        key={r.key}
        title={r.name}
        detail={r.detail}
        right={<VaccineStatusText status={r.status} date={r.date} />}
      />
    ));

  return (
    <div className="flex flex-col gap-8">
      {groups.action.length > 0 && (
        <Section title="Requiere acción">{list(groups.action)}</Section>
      )}
      {groups.valid.length > 0 && (
        <Section
          title="Vigente"
          extra={compact ? undefined : `Cobertura del esquema ${data.coverage} %`}
        >
          {list(groups.valid)}
        </Section>
      )}
      {groups.later.length > 0 && (
        <Section title="Aún no corresponde">{list(groups.later)}</Section>
      )}

      {!compact && petAlerts.length > 0 && (
        <Button
          onClick={() => downloadIcs(petAlerts, `vetify-${petName.toLowerCase()}.ics`)}
        >
          <CalendarPlus /> Agregar al calendario
        </Button>
      )}
    </div>
  );
}
