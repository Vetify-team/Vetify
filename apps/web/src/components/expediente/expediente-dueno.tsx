"use client";

import { CargandoLista, ErrorCarga } from "@/components/estados";
import { PantallaMascota } from "@/components/mascotas/pantalla-mascota";
import { useExpediente } from "@/hooks/useExpediente";
import { Historial } from "./historial";
import { FormularioObservacion } from "./registros-dueno";

function Contenido({ id }: { id: string }) {
  const { data, error, isPending, refetch } = useExpediente(id);
  if (isPending) return <CargandoLista filas={4} />;
  if (error) return <ErrorCarga error={error} reintentar={() => void refetch()} />;
  return <Historial expediente={data} />;
}

/** Expediente del dueño: el historial de todas las clínicas y su día a día. */
export function ExpedienteDueno({ id }: { id: string }) {
  return (
    <PantallaMascota
      id={id}
      titulo="Expediente"
      descripcion="Lo que registró cada clínica y lo que anotaste vos, en una sola historia."
    >
      {() => (
        <>
          <Contenido id={id} />
          <FormularioObservacion mascotaId={id} />
        </>
      )}
    </PantallaMascota>
  );
}
