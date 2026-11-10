"use client";

import { Download, Share } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstall } from "@/lib/install";

/**
 * Offers to install Vetify on the device. Where the browser allows it
 * (Android, desktop Chrome/Edge) one tap opens the install dialog; on iPhone
 * it explains the two taps Safari requires. Hidden once installed or when
 * opened from the installed app.
 */
export function InstallAppCard() {
  const state = useInstall();
  const [done, setDone] = useState(false);

  if (done)
    return (
      <p className="rounded-lg border border-primary/40 px-4 py-3 text-sm" role="status">
        Listo. Abrí Vetify desde el ícono en tu pantalla de inicio.
      </p>
    );
  if (!state || state.kind === "unavailable" || state.kind === "installed") return null;

  if (state.kind === "ios")
    return (
      <div className="rounded-lg border border-border px-4 py-3 text-sm">
        <p className="font-medium">Instalá Vetify en tu iPhone</p>
        <p className="mt-1 text-muted-foreground">
          En Safari tocá Compartir{" "}
          <Share className="inline size-4 align-[-2px] text-primary" aria-hidden /> y
          después &ldquo;Agregar a inicio&rdquo;.
        </p>
      </div>
    );

  return (
    <Button
      variant="outline"
      size="lg"
      className="h-13 w-full gap-2 text-base"
      onClick={async () => setDone(await state.install())}
    >
      <Download className="size-5" aria-hidden />
      Instalar Vetify
    </Button>
  );
}
