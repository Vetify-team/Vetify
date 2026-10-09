"use client";

import { Bell, CalendarDays, QrCode, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const PESTANAS = [
  { href: "/mascotas", texto: "Mascotas", icono: User },
  { href: "/esquema", texto: "Esquema", icono: CalendarDays },
  { href: "/carne", texto: "Carné", icono: QrCode },
  { href: "/avisos", texto: "Avisos", icono: Bell },
  { href: "/ajustes", texto: "Ajustes", icono: Settings },
] as const;

/** Qué pestaña corresponde a la ruta actual. */
function pestanaActiva(ruta: string): string {
  if (ruta.endsWith("/vacunas") || ruta === "/esquema") return "/esquema";
  if (ruta.endsWith("/carne") || ruta === "/carne") return "/carne";
  if (ruta.startsWith("/avisos")) return "/avisos";
  if (ruta.startsWith("/ajustes")) return "/ajustes";
  return "/mascotas";
}

/**
 * Navegación del dueño: barra de pestañas abajo en el teléfono y barra lateral
 * en escritorio. Misma jerarquía, una sola base de código.
 */
export function NavegacionDueno() {
  const activa = pestanaActiva(usePathname());

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-xl justify-around">
          {PESTANAS.map(({ href, texto, icono: Icono }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa === href ? "page" : undefined}
                className="flex min-w-14 flex-col items-center gap-1 px-2 py-2.5 text-[0.7rem] text-muted-foreground aria-[current=page]:text-primary"
              >
                <Icono className="size-5" strokeWidth={1.5} aria-hidden />
                {texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border px-5 py-8 md:flex">
        <Link href="/mascotas" className="font-display text-3xl font-medium">
          Vetify
        </Link>
        <p className="etiqueta mt-1">Expediente de tu mascota</p>
        <nav aria-label="Principal" className="mt-10">
          <ul className="flex flex-col gap-1">
            {PESTANAS.map(({ href, texto, icono: Icono }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={activa === href ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted",
                    "aria-[current=page]:bg-muted aria-[current=page]:text-foreground",
                  )}
                >
                  <Icono
                    className="size-4 group-aria-[current=page]:text-primary"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
