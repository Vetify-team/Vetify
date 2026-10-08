"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { inicioDeRol } from "@/components/ruta-protegida";
import { Skeleton } from "@/components/ui/skeleton";
import { useSesion } from "@/hooks/useSesion";

/** Entrada de la app: manda a cada quien a su inicio, o al login. */
export default function Inicio() {
  const { cargando, usuario } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (!cargando) router.replace(usuario ? inicioDeRol(usuario.rol) : "/iniciar-sesion");
  }, [cargando, usuario, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <Skeleton className="h-10 w-32" />
    </main>
  );
}
