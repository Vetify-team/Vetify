"use client";

import { PantallaMascota } from "@/components/mascotas/pantalla-mascota";
import { Esquema } from "./esquema";

export function EsquemaDueno({ id }: { id: string }) {
  return (
    <PantallaMascota
      id={id}
      titulo="Vacunación y desparasitación"
      descripcion="Generado según especie, edad y país. Cada dosis controla su propia vigencia."
    >
      {(m) => <Esquema mascotaId={m.id} nombre={m.nombre} />}
    </PantallaMascota>
  );
}
