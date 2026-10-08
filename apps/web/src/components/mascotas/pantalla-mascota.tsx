"use client";

import type { Mascota } from "@vetify/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { CargandoLista, ErrorCarga } from "@/components/estados";
import { TituloPantalla } from "@/components/sistema";
import { useMascota } from "@/hooks/useMascotas";
import { useMascotaActual } from "@/hooks/useMascotaActual";
import { rotuloMascota } from "./mascota-utiles";

/**
 * Marco de las pantallas de una mascota del dueño: la carga, la recuerda como
 * mascota actual y pone el encabezado "LUNA · GOLDEN RETRIEVER / Título".
 */
export function PantallaMascota({
  id,
  titulo,
  descripcion,
  accion,
  volver = { href: `/mascotas/${id}`, texto: "Perfil" },
  children,
}: {
  id: string;
  titulo?: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
  volver?: { href: string; texto: string } | null;
  children: (mascota: Mascota) => ReactNode;
}) {
  const { data: mascota, error, isPending, refetch } = useMascota(id);
  const elegir = useMascotaActual((s) => s.elegir);

  useEffect(() => {
    if (mascota) elegir(mascota.id);
  }, [mascota, elegir]);

  if (isPending) return <CargandoLista filas={3} />;
  if (error) return <ErrorCarga error={error} reintentar={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-8">
      {volver && (
        <Link
          href={volver.href}
          className="-mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> {volver.texto}
        </Link>
      )}
      {titulo && (
        <TituloPantalla
          etiqueta={rotuloMascota(mascota)}
          titulo={titulo}
          descripcion={descripcion}
          accion={accion}
        />
      )}
      {children(mascota)}
    </div>
  );
}
