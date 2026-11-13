"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicCardView, type PublicCard } from "@/components/pets/public-card-view";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

type Card = PublicCard;

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
          <div className="mt-8">
            <PublicCardView card={card} checkedAt={at} heading="h1" />
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Este carné muestra solo la vigencia de las vacunas. El expediente completo es
            privado y lo controla el dueño.
          </p>
        </>
      )}
    </main>
  );
}
