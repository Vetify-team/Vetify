"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";

const kg = (value: number) =>
  `${value.toLocaleString("es-CR", { maximumFractionDigits: 1 })} kg`;
const shortMonth = new Intl.DateTimeFormat("es-CR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

export function WeightChart({ series }: { series: { date: string; weight: number }[] }) {
  return (
    <figure
      className="h-52 border-b border-border"
      aria-label="Gráfica de la serie de peso"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => shortMonth.format(new Date(`${d}T00:00:00Z`))}
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
  );
}
