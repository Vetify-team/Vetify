import type { EstadoVacuna } from "@vetify/types";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { diasHasta, distancia } from "@/lib/formato";

/**
 * Piezas del sistema visual de Vetify. Todo es tipografía sobre papel o negro
 * cálido; el acento dorado queda para lo accionable y los estados se leen por
 * palabra, filete y peso, no por color.
 */

export function Etiqueta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("etiqueta", className)}>{children}</p>;
}

/** Encabezado de pantalla: rótulo, título en Cormorant y bajada opcional. */
export function TituloPantalla({
  etiqueta,
  titulo,
  descripcion,
  accion,
}: {
  etiqueta?: ReactNode;
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {etiqueta && <Etiqueta>{etiqueta}</Etiqueta>}
        <h1 className="font-display text-[2.1rem] leading-tight font-medium">{titulo}</h1>
        {descripcion && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{descripcion}</p>
        )}
      </div>
      {accion}
    </header>
  );
}

/** Sección con título y filete fuerte. */
export function Seccion({
  titulo,
  extra,
  children,
  className,
}: {
  titulo: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <div className="titulo-seccion flex items-baseline justify-between gap-3">
        <h2>{titulo}</h2>
        {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </section>
  );
}

/** Fila de lista: título, detalle y algo a la derecha. Con `href` es un enlace. */
export function Fila({
  titulo,
  detalle,
  derecha,
  izquierda,
  href,
}: {
  titulo: ReactNode;
  detalle?: ReactNode;
  derecha?: ReactNode;
  izquierda?: ReactNode;
  href?: string;
}) {
  const contenido = (
    <>
      {izquierda}
      <div className="min-w-0 flex-1">
        <div className="truncate">{titulo}</div>
        {detalle && <div className="mt-0.5 text-xs text-muted-foreground">{detalle}</div>}
      </div>
      {derecha}
      {href && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </>
  );
  const clase = "fila flex items-center gap-3";
  return href ? (
    <Link href={href} className={cn(clase, "transition-colors hover:bg-muted/50")}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

/** Cuadro con la inicial del nombre, en Cormorant. */
export function Inicial({ nombre, grande }: { nombre: string; grande?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border border-border bg-muted font-display text-foreground",
        grande ? "size-20 text-4xl" : "size-12 text-2xl",
      )}
    >
      {nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Estado en palabras. Lo que requiere acción va subrayado y con más peso;
 * lo que está al día, apagado. Se lee igual impreso o con daltonismo.
 */
export function EstadoTexto({
  estado,
  fecha,
}: {
  estado: EstadoVacuna;
  fecha?: string | null;
}) {
  const dias = fecha ? diasHasta(fecha) : null;
  const { texto, accion } = (() => {
    switch (estado) {
      case "vencida":
        return { texto: "Vencido", accion: true };
      case "pendiente":
        return { texto: "Pendiente", accion: true };
      case "por_vencer":
        return { texto: dias !== null ? distancia(dias) : "Por vencer", accion: true };
      case "no_aplica_aun":
        return {
          texto: dias !== null ? `En ${distancia(dias)}` : "Aún no",
          accion: false,
        };
      case "vigente":
        return { texto: dias !== null ? distancia(dias) : "Al día", accion: false };
    }
  })();

  return (
    <span
      className={cn(
        "shrink-0 font-display text-[0.72rem] uppercase tracking-[0.16em]",
        accion
          ? "border-b border-current pb-px font-bold text-foreground"
          : "text-muted-foreground",
      )}
    >
      {texto}
    </span>
  );
}
