import type { ReactNode } from "react";
import { NavegacionDueno } from "@/components/dueno/navegacion-dueno";
import { RutaProtegida } from "@/components/ruta-protegida";

/** Área del dueño: sus mascotas, el expediente y los permisos que otorga. */
export default function LayoutDueno({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <NavegacionDueno />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-8 pb-28 md:pb-12">
        <RutaProtegida rol="dueño">{children}</RutaProtegida>
      </main>
    </div>
  );
}
