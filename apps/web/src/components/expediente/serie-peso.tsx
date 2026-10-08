"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CargandoLista, ErrorCarga } from "@/components/estados";
import { Fila, Seccion } from "@/components/sistema";
import { useExpediente } from "@/hooks/useExpediente";
import { fecha } from "@/lib/formato";
import { FormularioPeso } from "./registros-dueno";

const kg = (valor: number) =>
  `${valor.toLocaleString("es-CR", { maximumFractionDigits: 1 })} kg`;
const mesCorto = new Intl.DateTimeFormat("es-CR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** Serie de peso: valor actual, tendencia, gráfica y registros. */
export function SeriePeso({
  mascotaId,
  puedeRegistrar,
}: {
  mascotaId: string;
  puedeRegistrar: boolean;
}) {
  const { data, error, isPending, refetch } = useExpediente(mascotaId);

  if (isPending) return <CargandoLista filas={3} />;
  if (error) return <ErrorCarga error={error} reintentar={() => void refetch()} />;

  const serie = data.registrosPeso.map((r) => ({ fecha: r.fecha, peso: r.pesoKg }));
  const ultimo = serie.at(-1);

  // Variación contra el registro más antiguo de los últimos tres meses.
  let variacion: string | null = null;
  if (ultimo && serie.length > 1) {
    const limite = new Date(`${ultimo.fecha}T00:00:00Z`);
    limite.setUTCMonth(limite.getUTCMonth() - 3);
    const base =
      serie.find((p) => p.fecha >= limite.toISOString().slice(0, 10)) ?? serie[0]!;
    if (base !== ultimo) {
      const delta = ultimo.peso - base.peso;
      variacion = `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${kg(Math.abs(delta))} desde ${fecha(base.fecha)}`;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-5xl font-medium">
          {ultimo ? kg(ultimo.peso) : "—"}
        </p>
        {variacion && <p className="text-sm text-muted-foreground">{variacion}</p>}
      </div>

      {serie.length >= 2 ? (
        <figure
          className="h-52 border-b border-border"
          aria-label="Gráfica de la serie de peso"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
              <XAxis
                dataKey="fecha"
                tickFormatter={(f: string) => mesCorto.format(new Date(`${f}T00:00:00Z`))}
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
                labelFormatter={(f) => fecha(String(f))}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--foreground)",
                }}
              />
              <Line
                type="monotone"
                dataKey="peso"
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

      {puedeRegistrar && <FormularioPeso mascotaId={mascotaId} />}

      <Seccion titulo="Registros recientes">
        {serie.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Todavía no hay registros de peso.
          </p>
        ) : (
          [...data.registrosPeso]
            .reverse()
            .slice(0, 12)
            .map((r) => (
              <Fila
                key={r.id}
                titulo={fecha(r.fecha)}
                derecha={<span className="text-sm">{kg(r.pesoKg)} · dueño</span>}
              />
            ))
        )}
      </Seccion>
    </div>
  );
}
