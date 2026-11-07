"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

type Card = Awaited<ReturnType<typeof api.verifyCard>>;
const labels: Record<string, string> = {
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Vencida",
  due: "Pendiente",
  not_yet_due: "Aún no corresponde",
};
export default function VerifyCardPage() {
  const [card, setCard] = useState<Card | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  useEffect(() => {
    let active = true;
    const token = window.location.hash.slice(1);
    (token ? api.verifyCard(token) : Promise.reject(new Error("Missing token")))
      .then((data) => {
        if (active) {
          setCard(data);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="mx-auto w-full max-w-lg p-6">
      <p className="text-primary">Vetify · Carné de vacunación</p>
      {state === "loading" && <p className="mt-6">Verificando carné…</p>}
      {state === "error" && (
        <p className="mt-6" role="alert">
          No se pudo verificar este carné. El enlace puede ser inválido o estar
          desactivado.
        </p>
      )}
      {card && (
        <>
          <h1 className="mt-6 font-display text-4xl">{card.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Estado de vacunas según el expediente actual.
          </p>
          <dl className="mt-6">
            {card.vaccines.map((v) => (
              <div key={v.vaccine} className="border-b border-border py-3">
                <dt className="font-semibold">{v.vaccine}</dt>
                <dd>
                  {labels[v.status] ?? v.status}
                  {v.expiresOn && ` · vence ${formatDate(v.expiresOn)}`}
                  {v.lastAppliedOn && ` · aplicada ${formatDate(v.lastAppliedOn)}`}
                </dd>
              </div>
            ))}
          </dl>
          {!card.vaccines.length && (
            <p className="mt-6">No hay vacunas en el esquema disponible.</p>
          )}
        </>
      )}
    </main>
  );
}
