"use client";

import { Plus, QrCode } from "lucide-react";
import Link from "next/link";
import { CargandoLista, ErrorCarga, Vacio } from "@/components/estados";
import {
  EstadoTexto,
  Fila,
  Inicial,
  Seccion,
  TituloPantalla,
} from "@/components/sistema";
import { buttonVariants } from "@/components/ui/button";
import { useAvisos } from "@/hooks/useExpediente";
import { useMascotas } from "@/hooks/useMascotas";
import { useSesion } from "@/hooks/useSesion";
import { fecha, saludo } from "@/lib/formato";
import { cn } from "cn";
import { descripcionMascota, resumenAvisos } from "./mascota-utiles";

/** Cuántas mascotas cubre el plan gratuito (ver modelo de negocio). */
const LIMITE_GRATUITO = 2;

/** Inicio del dueño: sus mascotas, accesos rápidos y el próximo aviso. */
export function MisMascotas() {
  const { usuario } = useSesion();
  const mascotas = useMascotas();
  const avisos = useAvisos();
  const nombre = usuario?.nombre.split(" ")[0] ?? "";

  const avisosDe = (id: string) => avisos.data?.filter((a) => a.mascotaId === id) ?? [];
  const proximos = (avisos.data ?? [])
    .filter((a) => a.estado !== "no_aplica_aun")
    .slice(0, 3);
  const primera = mascotas.data?.[0];

  return (
    <div className="flex flex-col gap-8">
      <TituloPantalla
        etiqueta={`${saludo()}, ${nombre}`}
        titulo="Mis mascotas"
        accion={
          <Link
            href="/mascotas/nueva"
            aria-label="Registrar mascota"
            className={cn(buttonVariants({ size: "icon-lg" }), "size-11 rounded-full")}
          >
            <Plus />
          </Link>
        }
      />

      {mascotas.isPending ? (
        <CargandoLista />
      ) : mascotas.error ? (
        <ErrorCarga error={mascotas.error} reintentar={() => void mascotas.refetch()} />
      ) : mascotas.data.length === 0 ? (
        <Vacio titulo="Todavía no registraste ninguna mascota.">
          <p className="text-sm text-muted-foreground">
            Empezá su expediente: es tuyo y la acompaña a cualquier veterinaria.
          </p>
          <Link href="/mascotas/nueva" className={buttonVariants()}>
            Registrar mi primera mascota
          </Link>
        </Vacio>
      ) : (
        <>
          <ul className="border-t border-filete">
            {mascotas.data.map((m) => {
              const resumen = resumenAvisos(avisosDe(m.id));
              return (
                <li key={m.id}>
                  <Fila
                    href={`/mascotas/${m.id}`}
                    izquierda={<Inicial nombre={m.nombre} />}
                    titulo={<span className="font-display text-xl">{m.nombre}</span>}
                    detalle={descripcionMascota(m)}
                    derecha={
                      avisos.data && (
                        <span
                          className={cn(
                            "font-display text-[0.72rem] uppercase tracking-[0.16em]",
                            resumen.accion
                              ? "border-b border-current font-bold"
                              : "text-muted-foreground",
                          )}
                        >
                          {resumen.texto}
                        </span>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>

          {mascotas.data.length >= LIMITE_GRATUITO && (
            <p className="-mt-4 text-xs text-muted-foreground">
              El plan gratuito cubre {LIMITE_GRATUITO} mascotas. Premium las cubre todas.
            </p>
          )}

          {primera && (
            <div className="grid grid-cols-2 gap-3">
              <Link href="/carne" className={buttonVariants()}>
                <QrCode /> Carné digital
              </Link>
              <Link
                href={`/mascotas/${primera.id}/peso`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Plus /> Registrar peso
              </Link>
            </div>
          )}
        </>
      )}

      {proximos.length > 0 && (
        <Seccion titulo="Próximo aviso">
          {proximos.map((a) => (
            <Fila
              key={`${a.mascotaId}-${a.nombre}`}
              titulo={`${a.nombre} de ${a.mascotaNombre}`}
              detalle={a.fecha ? fecha(a.fecha) : "Sin aplicar"}
              derecha={<EstadoTexto estado={a.estado} fecha={a.fecha} />}
            />
          ))}
        </Seccion>
      )}
    </div>
  );
}
