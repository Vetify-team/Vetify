"use client";

import type { AlcancePermiso, EntradaBitacora, PermisoConClinica } from "@vetify/types";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { CargandoLista, ErrorCarga } from "@/components/estados";
import { Fila, Seccion } from "@/components/sistema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useBitacora,
  useBuscarClinicas,
  useGestionPermisos,
  usePermisos,
} from "@/hooks/usePermisos";
import { mensajeDeError } from "@/lib/formularios";
import { cn } from "cn";

const ALCANCES: Record<AlcancePermiso, string> = {
  completo: "Puede ver y escribir",
  solo_carne: "Solo carné verificable",
};

const ACCIONES: Record<string, string> = {
  ver_expediente: "Consulta del expediente",
  ver_vacunacion: "Consulta del esquema",
  ver_mascota: "Consulta del perfil",
  ver_avisos: "Revisión de esquemas vencidos",
  registrar_consulta: "Registro de consulta",
  registrar_vacuna: "Registro de vacuna",
  registrar_desparasitacion: "Registro de desparasitación",
  registrar_tratamiento: "Registro de tratamiento",
  registrar_examen: "Registro de examen",
  registrar_peso: "Registro de peso",
  registrar_alimentacion: "Observación del día a día",
  otorgar_permiso: "Acceso otorgado",
  revocar_permiso: "Acceso revocado",
  ver_permisos: "Revisión de permisos",
  ver_bitacora: "Revisión de la bitácora",
  editar_mascota: "Edición del perfil",
};

const mesAnio = new Intl.DateTimeFormat("es-CR", { month: "short", year: "numeric" });
const diaMes = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short" });

function FilaPermiso({
  permiso,
  mascotaId,
}: {
  permiso: PermisoConClinica;
  mascotaId: string;
}) {
  const { revocar, otorgar } = useGestionPermisos(mascotaId);
  const activo = permiso.estado === "activo";
  const ocupado = revocar.isPending || otorgar.isPending;

  const cambiar = (encender: boolean) => {
    if (encender)
      otorgar.mutate({ clinicaId: permiso.clinicaId, alcance: permiso.alcance });
    else if (
      window.confirm(
        `¿Quitarle el acceso a ${permiso.clinica.nombre}? Lo pierde de inmediato.`,
      )
    ) {
      revocar.mutate(permiso.id);
    }
  };

  return (
    <div className="fila flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className={cn(!activo && "text-muted-foreground")}>{permiso.clinica.nombre}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {activo ? ALCANCES[permiso.alcance] : "Sin acceso"} · desde{" "}
          {mesAnio.format(new Date(permiso.creadoEn))}
        </p>
        {(revocar.isError || otorgar.isError) && (
          <p className="mt-1 text-xs text-destructive">
            {mensajeDeError(revocar.error ?? otorgar.error)}
          </p>
        )}
      </div>
      <Switch
        checked={activo}
        disabled={ocupado}
        onCheckedChange={cambiar}
        aria-label={`Acceso de ${permiso.clinica.nombre}`}
      />
    </div>
  );
}

function AgregarClinica({
  mascotaId,
  conAcceso,
}: {
  mascotaId: string;
  conAcceso: Set<string>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [alcance, setAlcance] = useState<AlcancePermiso>("completo");
  const diferida = useDeferredValue(busqueda);
  const { data: clinicas, isFetching } = useBuscarClinicas(diferida);
  const { otorgar } = useGestionPermisos(mascotaId);

  return (
    <Seccion titulo="Dar acceso a otra clínica">
      <div className="flex flex-col gap-3 pt-4">
        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label="Buscar clínica por nombre"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre de la clínica"
            className="h-11 rounded-md bg-transparent pl-9"
          />
        </div>
        <fieldset className="flex flex-wrap gap-2 text-sm">
          <legend className="sr-only">Qué puede hacer</legend>
          {(Object.keys(ALCANCES) as AlcancePermiso[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={alcance === opcion}
              onClick={() => setAlcance(opcion)}
              className="min-h-9 rounded-full border border-border px-3 text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
            >
              {ALCANCES[opcion]}
            </button>
          ))}
        </fieldset>
        {diferida.trim().length >= 2 && (
          <div>
            {isFetching && !clinicas && (
              <p className="py-3 text-sm text-muted-foreground">Buscando…</p>
            )}
            {clinicas?.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                No encontramos clínicas.
              </p>
            )}
            {clinicas?.map((clinica) => (
              <Fila
                key={clinica.id}
                titulo={clinica.nombre}
                detalle={clinica.direccion}
                derecha={
                  <Button
                    size="sm"
                    disabled={otorgar.isPending || conAcceso.has(clinica.id)}
                    onClick={() =>
                      otorgar.mutate(
                        { clinicaId: clinica.id, alcance },
                        { onSuccess: () => setBusqueda("") },
                      )
                    }
                  >
                    {conAcceso.has(clinica.id) ? "Ya tiene acceso" : "Dar acceso"}
                  </Button>
                }
              />
            ))}
          </div>
        )}
        {otorgar.isError && (
          <p className="text-sm text-destructive">{mensajeDeError(otorgar.error)}</p>
        )}
      </div>
    </Seccion>
  );
}

const quien = (e: EntradaBitacora) =>
  !e.actor ? "Alguien" : e.actor.rol === "dueño" ? "Vos" : e.actor.nombre;

function Bitacora({ mascotaId }: { mascotaId: string }) {
  const { data, error, isPending, refetch } = useBitacora(mascotaId);
  // Lo que hizo el dueño en su propia cuenta se resume; interesa ver a los demás.
  const [todo, setTodo] = useState(false);
  const entradas = (data ?? []).filter((e) => todo || e.actor?.rol !== "dueño");

  return (
    <Seccion
      titulo="Bitácora"
      extra={
        <button
          type="button"
          onClick={() => setTodo(!todo)}
          className="underline underline-offset-4"
        >
          {todo ? "Solo clínicas" : "Incluir lo mío"}
        </button>
      }
    >
      {isPending ? (
        <CargandoLista filas={2} />
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => void refetch()} />
      ) : entradas.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          Ninguna clínica accedió todavía.
        </p>
      ) : (
        entradas
          .slice(0, 40)
          .map((e) => (
            <Fila
              key={e.id}
              titulo={ACCIONES[e.accion] ?? e.accion}
              detalle={quien(e)}
              derecha={
                <time className="text-xs text-muted-foreground">
                  {diaMes.format(new Date(e.fecha))}
                </time>
              }
            />
          ))
      )}
    </Seccion>
  );
}

/** Consentimiento: quién ve el expediente, encender o apagar en un toque, y bitácora. */
export function GestionPermisos({ mascotaId }: { mascotaId: string }) {
  const { data, error, isPending, refetch } = usePermisos(mascotaId);
  const conAcceso = new Set(
    data?.filter((p) => p.estado === "activo").map((p) => p.clinicaId),
  );

  return (
    <div className="flex flex-col gap-10">
      <Seccion titulo="Con acceso">
        {isPending ? (
          <CargandoLista filas={2} />
        ) : error ? (
          <ErrorCarga error={error} reintentar={() => void refetch()} />
        ) : data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Ninguna clínica tiene acceso. Buscá tu veterinaria abajo para compartir el
            expediente.
          </p>
        ) : (
          data.map((permiso) => (
            <FilaPermiso key={permiso.id} permiso={permiso} mascotaId={mascotaId} />
          ))
        )}
      </Seccion>
      <AgregarClinica mascotaId={mascotaId} conAcceso={conAcceso} />
      <Bitacora mascotaId={mascotaId} />
    </div>
  );
}
