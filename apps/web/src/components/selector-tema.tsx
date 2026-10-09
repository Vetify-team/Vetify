"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { aplicarTema, leerTema, type Tema } from "@/lib/tema";
import { cn } from "cn";

const TEMAS: { valor: Tema; texto: string; icono: typeof Sun }[] = [
  { valor: "sistema", texto: "Como el sistema", icono: Monitor },
  { valor: "claro", texto: "Claro", icono: Sun },
  { valor: "oscuro", texto: "Oscuro", icono: Moon },
];

/**
 * Elige el tema claro (papel), oscuro (negro cálido) o el del sistema.
 * `compacto` muestra solo íconos, para la barra lateral del portal.
 */
export function SelectorTema({ compacto }: { compacto?: boolean }) {
  // Solo se monta en el cliente (detrás de RutaProtegida), así que leer
  // localStorage en el estado inicial no desalinea la hidratación.
  const [tema, setTema] = useState<Tema>(leerTema);

  const elegir = (valor: Tema) => {
    setTema(valor);
    aplicarTema(valor);
  };

  return (
    <fieldset className={cn("flex flex-wrap gap-2 text-sm", compacto && "gap-1")}>
      <legend className="sr-only">Tema</legend>
      {TEMAS.map(({ valor, texto, icono: Icono }) => (
        <button
          key={valor}
          type="button"
          aria-pressed={tema === valor}
          aria-label={compacto ? texto : undefined}
          title={compacto ? texto : undefined}
          onClick={() => elegir(valor)}
          className={cn(
            "flex items-center gap-2 rounded-full border border-border text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground",
            compacto ? "size-8 justify-center" : "min-h-10 px-4",
          )}
        >
          <Icono className="size-4" strokeWidth={1.5} aria-hidden />
          {!compacto && texto}
        </button>
      ))}
    </fieldset>
  );
}
