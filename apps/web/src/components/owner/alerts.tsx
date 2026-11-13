"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { VaccineStatusText } from "@/components/system";
import { LoadError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useInbox } from "@/hooks/useInbox";
import { useAlerts } from "@/hooks/useRecord";
import { downloadIcs } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { alertLabel } from "@/lib/labels";
import { NotificationInbox } from "./notification-inbox";
import { OwnerPageSkeleton } from "./owner-page-skeleton";

const card =
  "rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] dark:shadow-none dark:ring-1 dark:ring-border";

/** The inbox, and every date that needs action or comes next, for every pet. */
export function Alerts() {
  const { data, error, isPending, refetch } = useAlerts();
  const inbox = useInbox();

  if (isPending || inbox.isPending)
    return (
      <OwnerPageSkeleton page="alerts" alertData={data} notifications={inbox.data} />
    );

  const action =
    data?.filter(
      (a) => a.status === "expired" || a.status === "due" || a.status === "expiring",
    ) ?? [];
  const upcoming =
    data?.filter((a) => a.status === "valid" || a.status === "not_yet_due") ?? [];

  const list = (items: NonNullable<typeof data>) => (
    <ul className={cn(card, "divide-y divide-border/70 px-4")}>
      {items.map((a) => (
        <li key={`${a.petId}-${a.kind}-${a.name}`}>
          <Link
            href={`/mascotas/${a.petId}/vacunas`}
            className="flex items-center justify-between gap-3 py-3.5"
          >
            <span className="min-w-0">
              <span className="block truncate">
                {alertLabel(a)} de {a.petName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {a.dueOn ? formatDate(a.dueOn) : "Sin aplicar"}
              </span>
            </span>
            <VaccineStatusText
              status={a.status}
              date={a.status === "expired" ? null : a.dueOn}
            />
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
          Avisos
        </h1>
        <p className="mt-1 text-muted-foreground">
          Lo que te avisamos y las próximas fechas de todas tus mascotas.
        </p>
      </header>

      <NotificationInbox />

      {error ? (
        <LoadError error={error} retry={() => void refetch()} />
      ) : (
        data.length > 0 && (
          <section aria-labelledby="dates" className="flex flex-col gap-3">
            <h2 id="dates" className="font-display text-3xl leading-tight">
              Fechas
            </h2>
            {action.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="px-1 text-sm font-medium text-muted-foreground">
                  Requieren atención
                </h3>
                {list(action)}
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="px-1 text-sm font-medium text-muted-foreground">
                  Próximas
                </h3>
                {list(upcoming)}
              </div>
            )}
            {data.some((a) => a.dueOn) && (
              <Button
                variant="outline"
                className="w-fit"
                onClick={() => downloadIcs(data, "vetify-avisos.ics")}
              >
                <CalendarPlus aria-hidden /> Agregar todo al calendario
              </Button>
            )}
          </section>
        )
      )}
    </div>
  );
}
