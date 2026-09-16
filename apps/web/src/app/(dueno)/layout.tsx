import type { ReactNode } from "react";

/** Área del dueño: sus mascotas, el expediente y los permisos que otorga. */
export default function LayoutDueno({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-6">{children}</div>;
}
