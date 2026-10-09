"use client";

import { PantallaMascota } from "@/components/mascotas/pantalla-mascota";
import { GestionPermisos } from "./gestion-permisos";

export function PermisosDueno({ id }: { id: string }) {
  return (
    <PantallaMascota
      id={id}
      titulo="Quién puede ver el expediente"
      descripcion="El expediente es tuyo. Cada acceso es explícito, revocable y queda en bitácora."
    >
      {(m) => <GestionPermisos mascotaId={m.id} />}
    </PantallaMascota>
  );
}
