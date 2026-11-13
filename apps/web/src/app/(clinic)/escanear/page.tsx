import type { Metadata } from "next";
import { CardScanner } from "@/components/clinic/card-scanner";

export const metadata: Metadata = { title: "Escanear carné" };

/** The clinic scans an owner's public card (the only page allowed the camera). */
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
          Escanear carné
        </h1>
        <p className="mt-1 text-muted-foreground">
          La vigencia de las vacunas de cualquier mascota con carné de Vetify, aunque no
          sea tu paciente.
        </p>
      </header>
      <CardScanner />
    </div>
  );
}
