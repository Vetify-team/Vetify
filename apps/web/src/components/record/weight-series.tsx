"use client";

import { describeWeightChange, suddenWeightChange } from "@vetify/types";
import dynamic from "next/dynamic";
import { LoadError, LoadingList } from "@/components/states";
import { Row, Section, StatusWord } from "@/components/system";
import { useRecord } from "@/hooks/useRecord";
import { formatDate } from "@/lib/format";
import { WeightForm } from "./owner-entries";
import { RecordPagination } from "./record-pagination";

const kg = (value: number) =>
  `${value.toLocaleString("es-CR", { maximumFractionDigits: 1 })} kg`;
const WeightChart = dynamic(
  () => import("./weight-chart").then((mod) => mod.WeightChart),
  {
    ssr: false,
    loading: () => <div className="h-52" role="status" aria-label="Cargando gráfica" />,
  },
);

/** Weight series: current value, trend, chart and entries. */
export function WeightSeries({
  petId,
  birthDate,
  canRecord,
}: {
  petId: string;
  birthDate: string | null;
  canRecord: boolean;
}) {
  const { data, error, isPending, refetch } = useRecord(petId);

  if (isPending) return <LoadingList rows={3} />;
  if (error) return <LoadError error={error} retry={() => void refetch()} />;

  // The API sends newest first, with same-day entries in the order they were
  // written; reverse it and keep that order within a day.
  const weights = [...data.weightEntries]
    .reverse()
    .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
  const series = weights.map((w) => ({ date: w.recordedOn, weight: w.weightKg }));
  const latest = series.at(-1);
  const previous = series.at(-2);
  const sudden =
    latest && previous
      ? suddenWeightChange(
          { date: previous.date, weightKg: previous.weight },
          { date: latest.date, weightKg: latest.weight },
          birthDate,
        )
      : null;

  // Change against the oldest entry of the last three months.
  let change: string | null = null;
  if (latest && series.length > 1) {
    const limit = new Date(`${latest.date}T00:00:00Z`);
    limit.setUTCMonth(limit.getUTCMonth() - 3);
    const base =
      series.find((p) => p.date >= limit.toISOString().slice(0, 10)) ?? series[0]!;
    if (base !== latest) {
      const delta = latest.weight - base.weight;
      change = `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${kg(Math.abs(delta))} desde ${formatDate(base.date)}`;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-5xl font-medium">
          {latest ? kg(latest.weight) : "—"}
        </p>
        {change && <p className="text-sm text-muted-foreground">{change}</p>}
      </div>

      {sudden && (
        <div
          role="status"
          className="flex flex-col items-start gap-2 border-y border-border py-4"
        >
          <StatusWord action>Cambio brusco</StatusWord>
          <p className="text-sm">
            Desde el registro del {formatDate(sudden.previous.date)}, el peso{" "}
            {describeWeightChange(sudden)}.
            {/* The owner records weight; the clinic reading it is the vet. */}
            {canRecord && " Si no lo esperabas, consultalo con tu veterinario."}
          </p>
        </div>
      )}

      {series.length >= 2 ? (
        <WeightChart series={series} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Con dos registros o más aparece la gráfica de evolución.
        </p>
      )}

      {canRecord && <WeightForm petId={petId} />}

      <Section title="Registros recientes">
        {series.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Todavía no hay registros de peso.
          </p>
        ) : (
          [...weights]
            .reverse()
            .slice(0, 12)
            .map((w) => (
              <Row
                key={w.id}
                title={formatDate(w.recordedOn)}
                right={<span className="text-sm">{kg(w.weightKg)} · dueño</span>}
              />
            ))
        )}
      </Section>
      <RecordPagination petId={petId} section="weightEntries" />
    </div>
  );
}
