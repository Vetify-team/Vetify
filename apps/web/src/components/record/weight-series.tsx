"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoadError, LoadingList } from "@/components/states";
import { Row, Section } from "@/components/system";
import { useRecord } from "@/hooks/useRecord";
import { formatDate } from "@/lib/format";
import { WeightForm } from "./owner-entries";
import { RecordPagination } from "./record-pagination";

const kg = (value: number) =>
  `${value.toLocaleString("es-CR", { maximumFractionDigits: 1 })} kg`;
const shortMonth = new Intl.DateTimeFormat("es-CR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** Weight series: current value, trend, chart and entries. */
export function WeightSeries({
  petId,
  canRecord,
}: {
  petId: string;
  canRecord: boolean;
}) {
  const { data, error, isPending, refetch } = useRecord(petId);

  if (isPending) return <LoadingList rows={3} />;
  if (error) return <LoadError error={error} retry={() => void refetch()} />;

  const weights = [...data.weightEntries].sort(
    (a, b) => a.recordedOn.localeCompare(b.recordedOn) || a.id.localeCompare(b.id),
  );
  const series = weights.map((w) => ({ date: w.recordedOn, weight: w.weightKg }));
  const latest = series.at(-1);

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

      {series.length >= 2 ? (
        <figure
          className="h-52 border-b border-border"
          aria-label="Gráfica de la serie de peso"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) =>
                  shortMonth.format(new Date(`${d}T00:00:00Z`))
                }
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tickFormatter={(v: number) =>
                  v.toLocaleString("es-CR", { maximumFractionDigits: 1 })
                }
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                formatter={(v) => [kg(Number(v)), "Peso"]}
                labelFormatter={(d) => formatDate(String(d))}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--foreground)",
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "var(--primary)" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </figure>
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
