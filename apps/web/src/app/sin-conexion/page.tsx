import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión · Vetify" };

/** Respaldo del service worker cuando se navega a una ruta no cacheada. */
export default function PaginaSinConexion() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-serif text-2xl">Estás sin conexión</h1>
      <p className="text-sm opacity-80">
        No pudimos contactar el servidor. El expediente que ya habías abierto sigue
        disponible; volvé a intentarlo cuando recuperes la señal.
      </p>
    </main>
  );
}
