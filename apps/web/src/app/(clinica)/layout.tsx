import type { ReactNode } from "react";

/** Portal de la clínica: solo pacientes con permiso activo del dueño. */
export default function LayoutClinica({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>;
}
