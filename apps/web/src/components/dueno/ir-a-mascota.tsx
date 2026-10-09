"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CargandoLista, ErrorCarga, Vacio } from "@/components/estados";
import { buttonVariants } from "@/components/ui/button";
import { useMascotaActual } from "@/hooks/useMascotaActual";
import { useMascotas } from "@/hooks/useMascotas";

/**
 * Las pestañas "Esquema" y "Carné" son de una mascota: llevan a la última que
 * abrió el dueño, o a la primera si todavía no abrió ninguna.
 */
export function IrAMascota({ seccion }: { seccion: "vacunas" | "carne" }) {
  const { data, error, isPending, refetch } = useMascotas();
  const actual = useMascotaActual((s) => s.id);
  const router = useRouter();

  const destino = data?.find((m) => m.id === actual) ?? data?.[0];

  useEffect(() => {
    if (destino) router.replace(`/mascotas/${destino.id}/${seccion}`);
  }, [destino, seccion, router]);

  if (error) return <ErrorCarga error={error} reintentar={() => void refetch()} />;
  if (isPending || destino) return <CargandoLista filas={3} />;
  return (
    <Vacio titulo="Primero registrá una mascota.">
      <Link href="/mascotas/nueva" className={buttonVariants()}>
        Registrar mascota
      </Link>
    </Vacio>
  );
}
