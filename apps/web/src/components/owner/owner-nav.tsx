"use client";

import { Bell, CalendarDays, QrCode, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TABS = [
  { href: "/mascotas", text: "Mascotas", icon: User },
  { href: "/esquema", text: "Esquema", icon: CalendarDays },
  { href: "/carne", text: "Carné", icon: QrCode },
  { href: "/avisos", text: "Avisos", icon: Bell },
  { href: "/ajustes", text: "Ajustes", icon: Settings },
] as const;

/** Which tab the current route belongs to. */
function activeTab(path: string): string {
  if (path.endsWith("/vacunas") || path === "/esquema") return "/esquema";
  if (path.endsWith("/carne") || path === "/carne") return "/carne";
  if (path.startsWith("/avisos")) return "/avisos";
  if (path.startsWith("/ajustes")) return "/ajustes";
  return "/mascotas";
}

/**
 * Owner navigation: a tab bar at the bottom on phones and a sidebar on
 * desktop. Same hierarchy, one code base.
 */
export function OwnerNav() {
  const active = activeTab(usePathname());

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-xl justify-around">
          {TABS.map(({ href, text, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active === href ? "page" : undefined}
                className="flex min-w-14 flex-col items-center gap-1 px-2 py-2.5 text-[0.7rem] text-muted-foreground aria-[current=page]:text-primary"
              >
                <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                {text}
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
            {TABS.map(({ href, text, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active === href ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted",
                    "aria-[current=page]:bg-muted aria-[current=page]:text-foreground",
                  )}
                >
                  <Icon
                    className="size-4 group-aria-[current=page]:text-primary"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {text}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
