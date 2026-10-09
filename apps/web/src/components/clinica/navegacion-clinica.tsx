"use client";

import { AlertCircle, LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SelectorTema } from "@/components/selector-tema";
import { useMiClinica } from "@/hooks/usePermisos";
import { useSesion } from "@/hooks/useSesion";

const SECCIONES = [
  { href: "/pacientes", texto: "Pacientes", icono: User },
  { href: "/vencidos", texto: "Esquemas vencidos", icono: AlertCircle },
] as const;

const iniciales = (nombre: string) =>
  nombre
    .replace(/^(dra?\.)\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

/** Barra lateral del portal clínico; en pantallas chicas se vuelve barra superior. */
export function NavegacionClinica() {
  const ruta = usePathname();
  const router = useRouter();
  const { data: clinica } = useMiClinica();
  const { usuario, cerrarSesion } = useSesion();

  const salir = () =>
    cerrarSesion.mutate(undefined, {
      onSettled: () => router.replace("/iniciar-sesion"),
    });

  const enlaces = SECCIONES.map(({ href, texto, icono: Icono }) => (
    <li key={href}>
      <Link
        href={href}
        aria-current={ruta.startsWith(href) ? "page" : undefined}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
      >
        <Icono className="size-4" strokeWidth={1.5} aria-hidden />
        {texto}
      </Link>
    </li>
  ));

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:hidden">
        <Link href="/pacientes" className="font-display text-2xl font-medium">
          Vetify
        </Link>
        <nav aria-label="Portal">
          <ul className="flex gap-1">{enlaces}</ul>
        </nav>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border lg:flex">
        <div className="border-b border-border px-6 py-6">
          <Link href="/pacientes" className="font-display text-3xl font-medium">
            Vetify
          </Link>
          <p className="etiqueta mt-0.5 !text-primary">Portal clínico</p>
          <p className="mt-3 min-h-5 text-sm text-muted-foreground">{clinica?.nombre}</p>
        </div>
        <nav aria-label="Portal" className="px-3 py-5">
          <ul className="flex flex-col gap-1">{enlaces}</ul>
        </nav>
        {/* Solo con sesión cargada (en el cliente): el tema guardado vive en el navegador. */}
        {usuario && (
          <div className="mt-auto px-6 py-4">
            <SelectorTema compacto />
          </div>
        )}
        {usuario && (
          <div className="flex items-center gap-3 border-t border-border px-6 py-4">
            <span className="flex size-9 items-center justify-center rounded-full border border-border text-xs">
              {iniciales(usuario.nombre)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{usuario.nombre}</span>
            <button
              type="button"
              onClick={salir}
              aria-label="Cerrar sesión"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
