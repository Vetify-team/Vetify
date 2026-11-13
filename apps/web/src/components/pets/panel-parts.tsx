"use client";

import {
  CalendarCheck,
  Pill,
  Scale,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { StatusPill } from "@/components/system";
import { useAlerts, useLatestWeights } from "@/hooks/useRecord";
import { formatDate } from "@/lib/format";
import { formatChange, formatKg, latestWeight, nextDose } from "@/lib/pet-summary";

/**
 * Pieces shared by the owner's pet panel and the clinic's patient file: the
 * card surface and the indicators at a glance.
 */

export const cardSurface =
  "rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] dark:shadow-none dark:ring-1 dark:ring-border";

/** One indicator: a link when it leads somewhere, a plain card otherwise. */
export function Indicator({
  href,
  icon: Icon,
  label,
  children,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1.5">{children}</span>
    </>
  );
  const className = cn(cardSurface, "flex min-w-0 flex-col gap-2 p-4");
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** The next vaccine (or the expired one) of a pet. */
export function VaccineIndicator({ petId, href }: { petId: string; href?: string }) {
  const alerts = useAlerts();
  const dose = nextDose(
    alerts.data?.filter((a) => a.petId === petId) ?? [],
    "vaccination",
  );
  return (
    <Indicator href={href} icon={CalendarCheck} label="Próxima vacuna">
      <StatusPill tone={dose.tone}>{dose.title}</StatusPill>
      <span className="text-xs text-muted-foreground">
        {alerts.isPending ? "…" : dose.detail}
      </span>
    </Indicator>
  );
}

/** The next deworming (or the overdue one) of a pet. */
export function DewormingIndicator({ petId, href }: { petId: string; href?: string }) {
  const alerts = useAlerts();
  const dose = nextDose(alerts.data?.filter((a) => a.petId === petId) ?? [], "deworming");
  return (
    <Indicator href={href} icon={Pill} label="Desparasitación">
      <StatusPill tone={dose.tone}>{dose.title}</StatusPill>
      <span className="text-xs text-muted-foreground">
        {alerts.isPending ? "…" : dose.detail}
      </span>
    </Indicator>
  );
}

/** The last weight and how it changed since the one before. */
export function WeightIndicator({ petId, href }: { petId: string; href?: string }) {
  const weights = useLatestWeights(petId);
  const weight = weights.data ? latestWeight(weights.data) : null;
  const change = weight && formatChange(weight.change);
  const Trend = weight?.change && weight.change < 0 ? TrendingDown : TrendingUp;
  return (
    <Indicator href={href} icon={Scale} label="Último peso">
      {weight ? (
        <>
          <span className="font-display text-3xl leading-none lining-nums">
            {formatKg(weight.kg)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {change && weight.change !== 0 && <Trend className="size-3.5" aria-hidden />}
            {change ?? formatDate(weight.recordedOn)}
          </span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">
          {weights.isPending ? "…" : "Sin registros"}
        </span>
      )}
    </Indicator>
  );
}
