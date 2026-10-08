"use client";

import {
  crearConsultaSchema,
  crearDesparasitacionSchema,
  crearVacunaSchema,
} from "@vetify/types";
import { useState, type ReactNode } from "react";
import { AreaTexto, Campo, Selector } from "@/components/campos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRegistrosExpediente, useVacunacion } from "@/hooks/useExpediente";
import { hoy } from "@/lib/formato";
import { FormularioRapido } from "./formulario-rapido";

/** Botón que abre un formulario en un diálogo y lo cierra al guardar. */
function Accion({
  texto,
  titulo,
  descripcion,
  principal,
  children,
}: {
  texto: string;
  titulo: string;
  descripcion: string;
  principal?: boolean;
  children: (cerrar: () => void) => ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant={principal ? "default" : "outline"} />}>
        {texto}
      </DialogTrigger>
      <DialogContent className="gap-6 rounded-lg p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-medium">
            {titulo}
          </DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        {children(() => setAbierto(false))}
      </DialogContent>
    </Dialog>
  );
}

/** Lo que registra la clínica con permiso activo: el acto médico. */
export function AccionesClinica({ mascotaId }: { mascotaId: string }) {
  const registros = useRegistrosExpediente(mascotaId);
  // Las vacunas del esquema se ofrecen como lista para que el nombre coincida
  // con el catálogo y el API pueda calcular el vencimiento.
  const { data: vacunacion } = useVacunacion(mascotaId);
  const vacunasDelEsquema = vacunacion?.vacunas.map((v) => v.vacuna) ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      <Accion
        texto="Desparasitación"
        titulo="Desparasitación"
        descripcion="Producto, tipo y próxima dosis."
      >
        {(cerrar) => (
          <FormularioRapido
            esquema={crearDesparasitacionSchema}
            mutacion={registros.desparasitacion}
            alGuardar={cerrar}
          >
            {(errores) => (
              <>
                <Campo etiqueta="Producto" nombre="producto" error={errores.producto} />
                <Selector
                  etiqueta="Tipo"
                  nombre="tipo"
                  opciones={[
                    { valor: "interna", texto: "Interna" },
                    { valor: "externa", texto: "Externa" },
                  ]}
                  error={errores.tipo}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    etiqueta="Fecha"
                    nombre="fecha"
                    type="date"
                    defaultValue={hoy()}
                    error={errores.fecha}
                  />
                  <Campo
                    etiqueta="Próxima dosis"
                    nombre="proximaFecha"
                    type="date"
                    error={errores.proximaFecha}
                  />
                </div>
              </>
            )}
          </FormularioRapido>
        )}
      </Accion>

      <Accion
        texto="Aplicar vacuna"
        titulo="Aplicar vacuna"
        descripcion="Si no indicás vencimiento, se calcula con el esquema del país."
      >
        {(cerrar) => (
          <FormularioRapido
            esquema={crearVacunaSchema}
            mutacion={registros.vacuna}
            alGuardar={cerrar}
          >
            {(errores) => (
              <>
                {vacunasDelEsquema.length > 0 ? (
                  <Selector
                    etiqueta="Vacuna"
                    nombre="tipo"
                    opciones={vacunasDelEsquema.map((v) => ({ valor: v, texto: v }))}
                    error={errores.tipo}
                  />
                ) : (
                  <Campo etiqueta="Vacuna" nombre="tipo" error={errores.tipo} />
                )}
                <Campo etiqueta="Lote" nombre="lote" error={errores.lote} />
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    etiqueta="Aplicación"
                    nombre="fechaAplicacion"
                    type="date"
                    defaultValue={hoy()}
                    error={errores.fechaAplicacion}
                  />
                  <Campo
                    etiqueta="Vencimiento"
                    nombre="fechaVencimiento"
                    type="date"
                    error={errores.fechaVencimiento}
                  />
                </div>
              </>
            )}
          </FormularioRapido>
        )}
      </Accion>

      <Accion
        principal
        texto="Registrar consulta"
        titulo="Registrar consulta"
        descripcion="Queda en el expediente del dueño a nombre de tu clínica."
      >
        {(cerrar) => (
          <FormularioRapido
            esquema={crearConsultaSchema}
            mutacion={registros.consulta}
            alGuardar={cerrar}
          >
            {(errores) => (
              <>
                <Campo etiqueta="Motivo" nombre="motivo" error={errores.motivo} />
                <AreaTexto
                  etiqueta="Diagnóstico"
                  nombre="diagnostico"
                  error={errores.diagnostico}
                />
                <AreaTexto etiqueta="Notas" nombre="notas" error={errores.notas} />
              </>
            )}
          </FormularioRapido>
        )}
      </Accion>
    </div>
  );
}
