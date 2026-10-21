"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";

/** Skeleton of a list while it loads. */
export function LoadingList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
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

/** Load error with a Spanish message and a retry option. */
export function LoadError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 border-l-2 border-foreground py-1 pl-4 text-sm"
    >
      <p>{errorMessage(error)}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Empty state with a call to action. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <p className="font-display text-2xl">{title}</p>
      {children}
    </div>
  );
}
