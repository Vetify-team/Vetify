"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mensajeDeError } from "@/lib/formularios";

/** Esqueleto de una lista mientras carga. */
export function CargandoLista({ filas = 3 }: { filas?: number }) {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="fila flex items-center gap-3">
          <Skeleton className="size-12 rounded-none" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Error de carga con mensaje en español y opción de reintentar. */
export function ErrorCarga({
  error,
  reintentar,
}: {
  error: unknown;
  reintentar?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 border-l-2 border-foreground py-1 pl-4 text-sm"
    >
      <p>{mensajeDeError(error)}</p>
      {reintentar && (
        <Button variant="outline" size="sm" onClick={reintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Estado vacío con llamado a la acción. */
export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <p className="font-display text-2xl">{titulo}</p>
      {children}
    </div>
  );
}
