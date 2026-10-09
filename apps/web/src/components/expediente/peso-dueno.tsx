"use client";

import { PantallaMascota } from "@/components/mascotas/pantalla-mascota";
import { SeriePeso } from "./serie-peso";

export function PesoDueno({ id }: { id: string }) {
  return (
    <PantallaMascota id={id} titulo="Serie de peso">
      {(m) => <SeriePeso mascotaId={m.id} puedeRegistrar />}
    </PantallaMascota>
  );
}
