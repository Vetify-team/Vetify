import type { ReactNode } from "react";
import { NavegacionClinica } from "@/components/clinica/navegacion-clinica";
import { RutaProtegida } from "@/components/ruta-protegida";

/** Portal de la clínica: solo pacientes con permiso activo del dueño. */
export default function LayoutClinica({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <NavegacionClinica />
      <main className="w-full min-w-0 flex-1 px-5 py-8 lg:px-10">
        <RutaProtegida rol="clinica">{children}</RutaProtegida>
      </main>
    </div>
  );
}
