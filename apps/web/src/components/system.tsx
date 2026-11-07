import type { VaccineStatus } from "@vetify/types";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { daysUntil, distance } from "@/lib/format";

/**
 * Pieces of Vetify's visual system. Everything is typography on paper or
 * warm black; the gold accent is reserved for actionable things and states
 * read by word, rule and weight, never by color.
 */

export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("etiqueta", className)}>{children}</p>;
}

/** Screen header: small-caps label, Cormorant title and optional lead. */
export function ScreenTitle({
  label,
  title,
  description,
  action,
}: {
  label?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {label && <Label>{label}</Label>}
        <h1 className="font-display text-[2.1rem] leading-tight font-medium">{title}</h1>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

/** Section with a title and a strong rule. */
export function Section({
  title,
  extra,
  children,
  className,
}: {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <div className="titulo-seccion flex items-baseline justify-between gap-3">
        <h2>{title}</h2>
        {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </section>
  );
}

/** List row: title, detail and something on the right. With `href` it is a link. */
export function Row({
  title,
  detail,
  right,
  left,
  href,
}: {
  title: ReactNode;
  detail?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      {left}
      <div className="min-w-0 flex-1">
        <div className="truncate">{title}</div>
        {detail && <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>}
      </div>
      {right}
      {href && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </>
  );
  const className = "fila flex items-center gap-3";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:bg-muted/50")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Box with the name's initial, in Cormorant. */
export function Initial({ name, large }: { name: string; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border border-border bg-muted font-display text-foreground",
        large ? "size-20 text-4xl" : "size-12 text-2xl",
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Small-caps word; underlined and heavier when it needs action. */
export function StatusWord({
  children,
  action,
}: {
  children: ReactNode;
  action: boolean;
}) {
  return (
    <span
      className={cn(
        "shrink-0 font-display text-[0.72rem] uppercase tracking-[0.16em]",
        action
          ? "border-b border-current pb-px font-bold text-foreground"
          : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/**
 * A vaccine status in words. What needs action is underlined and heavier;
 * what is fine, muted. Reads the same printed or with color blindness.
 */
export function VaccineStatusText({
  status,
  date,
}: {
  status: VaccineStatus;
  date?: string | null;
}) {
  const days = date ? daysUntil(date) : null;
  const { text, action } = (() => {
    switch (status) {
      case "expired":
        return { text: "Vencido", action: true };
      case "due":
        return { text: "Pendiente", action: true };
      case "expiring":
        return { text: days !== null ? distance(days) : "Por vencer", action: true };
      case "not_yet_due":
        return { text: days !== null ? `En ${distance(days)}` : "Aún no", action: false };
      case "valid":
        return { text: days !== null ? distance(days) : "Al día", action: false };
    }
  })();
  return <StatusWord action={action}>{text}</StatusWord>;
}
