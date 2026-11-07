import type { ReactNode } from "react";

/** Screens without a session: log-in and sign-up. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-12">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-10">
        <header>
          <p className="etiqueta">Expediente clínico compartido</p>
          <p className="font-display text-6xl leading-none font-medium">Vetify</p>
          <p className="mt-3 font-display text-xl text-primary">
            El expediente pertenece al dueño, no a la clínica.
          </p>
        </header>
        {children}
      </div>
    </main>
  );
}
