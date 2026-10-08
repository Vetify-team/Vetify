"use client";

import type { RolUsuario } from "@vetify/types";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSesion } from "@/hooks/useSesion";

/** Pantalla de inicio de cada rol. */
export const inicioDeRol = (rol: RolUsuario): string =>
  rol === "dueño" ? "/mascotas" : "/pacientes";

/**
 * Redirige a quien no tiene sesión o no tiene el rol del área. Es solo
 * navegación: la autorización real la aplica el API en cada petición.
 */
export function RutaProtegida({
  rol,
  children,
}: {
  rol: RolUsuario;
  children: ReactNode;
}) {
  const { cargando, usuario } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    if (!usuario) router.replace("/iniciar-sesion");
    else if (usuario.rol !== rol) router.replace(inicioDeRol(usuario.rol));
  }, [cargando, usuario, rol, router]);

  if (cargando || !usuario || usuario.rol !== rol) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return children;
}
