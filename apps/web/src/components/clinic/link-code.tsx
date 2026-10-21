"use client";

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "@/components/fields";
import { LoadError, LoadingList } from "@/components/states";
import { ScreenTitle } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useIssueLinkCode, useMyClinic } from "@/hooks/useClinic";
import { errorMessage } from "@/lib/errors";

/** mm:ss left until the code expires. */
function useCountdown(expiresAt: string | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const left = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/**
 * The clinic shows this code to the owner in person; the owner types it to
 * grant access. That is what keeps anyone from impersonating a clinic
 * remotely. Only verified clinics can issue codes.
 */
export function LinkCodeScreen() {
  const clinic = useMyClinic();
  const issue = useIssueLinkCode();
  const left = useCountdown(issue.data?.expiresAt);
  const expired = left === "0:00";

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <ScreenTitle
        label="Vinculación"
        title="Código de vinculación"
        description="Mostrale este código al dueño en la consulta. Lo escribe en su app para darle a tu clínica acceso al expediente. Sirve una vez y dura 10 minutos."
      />

      {clinic.isPending ? (
        <LoadingList rows={1} />
      ) : clinic.error ? (
        <LoadError error={clinic.error} retry={() => void clinic.refetch()} />
      ) : !clinic.data.verified ? (
        <div className="border-l-2 border-foreground py-1 pl-4 text-sm">
          <p className="font-medium">Tu clínica está en verificación.</p>
          <p className="mt-1 text-muted-foreground">
            Vetify revisa cada clínica antes de que pueda recibir expedientes, para que
            nadie se haga pasar por otra. Cuando esté verificada vas a poder generar
            códigos acá.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {issue.data && !expired ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-10">
              <p className="font-mono text-5xl tracking-[0.25em]" aria-live="polite">
                {issue.data.code}
              </p>
              <p className="text-sm text-muted-foreground">Vence en {left}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground">
              <KeyRound className="size-8" strokeWidth={1} aria-hidden />
              {expired ? "El código venció." : "Todavía no generaste un código."}
            </div>
          )}
          <FormError message={issue.isError ? errorMessage(issue.error) : null} />
          <Button onClick={() => issue.mutate()} disabled={issue.isPending}>
            {issue.isPending
              ? "Generando…"
              : issue.data
                ? "Generar otro código"
                : "Generar código"}
          </Button>
        </div>
      )}
    </div>
  );
}
