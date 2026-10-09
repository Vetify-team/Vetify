"use client";

import { crearRegistroAlimentacionSchema, crearRegistroPesoSchema } from "@vetify/types";
import { AreaTexto, Campo } from "@/components/campos";
import { useRegistrosExpediente } from "@/hooks/useExpediente";
import { hoy } from "@/lib/formato";
import { FormularioRapido } from "./formulario-rapido";

/** Peso de hoy: lo registra el dueño. */
export function FormularioPeso({ mascotaId }: { mascotaId: string }) {
  const { peso } = useRegistrosExpediente(mascotaId);
  return (
    <FormularioRapido
      esquema={crearRegistroPesoSchema}
      mutacion={peso}
      textoBoton="Registrar peso de hoy"
      transformar={(d) => ({
        ...d,
        pesoKg: d.pesoKg === undefined ? undefined : Number(d.pesoKg),
      })}
    >
      {(errores) => (
        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta="Peso (kg)"
            nombre="pesoKg"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            error={errores.pesoKg}
          />
          <Campo
            etiqueta="Fecha"
            nombre="fecha"
            type="date"
            defaultValue={hoy()}
            max={hoy()}
            error={errores.fecha}
          />
        </div>
      )}
    </FormularioRapido>
  );
}

/** Alimentación u observación del día a día. */
export function FormularioObservacion({ mascotaId }: { mascotaId: string }) {
  const { alimentacion } = useRegistrosExpediente(mascotaId);
  return (
    <FormularioRapido
      titulo="Anotar una observación"
      esquema={crearRegistroAlimentacionSchema}
      mutacion={alimentacion}
      textoBoton="Guardar observación"
    >
      {(errores) => (
        <>
          <AreaTexto
            etiqueta="Alimentación, comportamiento o lo que notaste"
            nombre="detalle"
            placeholder="Ej.: comió menos de lo normal"
            error={errores.detalle}
          />
          <Campo
            etiqueta="Fecha"
            nombre="fecha"
            type="date"
            defaultValue={hoy()}
            max={hoy()}
            error={errores.fecha}
          />
        </>
      )}
    </FormularioRapido>
  );
}
