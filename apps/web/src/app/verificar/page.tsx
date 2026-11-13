"use client";

import type { VaccineStatus } from "@vetify/types";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/system";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { STATUS_WORD, toneOf } from "@/lib/pet-summary";

type Card = Awaited<ReturnType<typeof api.verifyCard>>;

const checkedAt = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Vence 20 nov 2026", "Venció 15 mar 2026"… */
function detail(v: Card["vaccines"][number]): string {
  if (v.expiresOn)
    return `${v.status === "expired" ? "Venció" : "Vence"} ${formatDate(v.expiresOn)}`;
  if (v.lastAppliedOn) return `Aplicada ${formatDate(v.lastAppliedOn)}`;
  return "Sin aplicar";
}

/**
 * Public page of a vaccination card, opened by scanning its QR: the pet's
 * name and the validity of its vaccines, nothing else of the record. The
 * token comes in the #fragment, so it never reaches a server log.
 */
export default function VerifyCardPage() {
  const [card, setCard] = useState<Card | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    const token = window.location.hash.slice(1);
    (token ? api.verifyCard(token) : Promise.reject(new Error("Missing token")))
      .then((data) => {
        if (!active) return;
        setCard(data);
        setAt(new Date());
        setState("ready");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <p className="font-display text-2xl">Vetify</p>
      <p className="text-sm text-muted-foreground">Carné de vacunación</p>

      {state === "loading" && (
        <div
          role="status"
          aria-label="Verificando el carné"
          className="mt-8 flex flex-col gap-4"
        >
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-8 w-1/2 rounded-full" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      )}

      {state === "error" && (
        <div
          role="alert"
          className="mt-8 flex flex-col items-start gap-3 rounded-3xl bg-card p-6 shadow-sm"
        >
          <ShieldAlert className="size-8 text-alert" strokeWidth={1.5} aria-hidden />
          <p className="font-display text-3xl leading-tight">
            No se pudo verificar este carné
          </p>
          <p className="text-muted-foreground">
            El enlace no es válido o el dueño desactivó el QR. Pedile que te muestre el
            carné actualizado.
          </p>
        </div>
      )}

      {card && (
        <>
          <h1 className="mt-8 font-display text-6xl leading-none font-medium break-words">
            {card.name}
          </h1>
          <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-ok/12 px-3 py-1.5 text-sm font-medium text-ok">
            <BadgeCheck className="size-4" aria-hidden /> Carné verificado por Vetify
          </p>
          {at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Consultado el {checkedAt.format(at)}, con el expediente al día.
            </p>
          )}

          <section
            aria-label="Vacunas"
            className="mt-6 rounded-3xl bg-card px-5 py-2 shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.06)] dark:shadow-none dark:ring-1 dark:ring-border"
          >
            {card.vaccines.length === 0 ? (
              <p className="py-5 text-muted-foreground">
                Todavía no tiene vacunas registradas por una clínica.
              </p>
            ) : (
              <dl className="divide-y divide-border/70">
                {card.vaccines.map((v) => (
                  <div
                    key={v.vaccine}
                    className="flex items-center justify-between gap-3 py-4"
                  >
                    <dt className="min-w-0">
                      <span className="block text-lg font-medium">{v.vaccine}</span>
                      <span className="block text-sm text-muted-foreground">
                        {detail(v)}
                      </span>
                    </dt>
                    <dd>
                      <StatusPill tone={toneOf[v.status as VaccineStatus]}>
                        {STATUS_WORD[v.status as VaccineStatus]}
                      </StatusPill>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <p className="mt-6 text-sm text-muted-foreground">
            Este carné muestra solo la vigencia de las vacunas. El expediente completo es
            privado y lo controla el dueño.
          </p>
        </>
      )}
    </main>
  );
}
