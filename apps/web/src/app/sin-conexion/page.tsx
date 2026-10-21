import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión · Vetify" };

/**
 * Service worker fallback when navigating offline. Health data is never
 * stored on the device, so this page explains why nothing can be shown.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-display text-3xl">Estás sin conexión</h1>
      <p className="text-sm text-muted-foreground">
        Por privacidad, Vetify no guarda los expedientes en el dispositivo. Volvé a
        intentarlo cuando recuperes la señal.
      </p>
    </main>
  );
}
