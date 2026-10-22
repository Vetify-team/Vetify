"use client";

import { LogOut, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ThemePicker } from "@/components/theme-picker";
import { useSession } from "@/hooks/useSession";

const initials = (name: string) =>
  name
    .replace(/^(dra?\.)\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

/**
 * Sidebar of the desktop portals (clinic and admin); on small screens it
 * becomes a top bar.
 */
export function PortalSidebar({
  label,
  subtitle,
  home,
  sections,
}: {
  label: string;
  subtitle?: ReactNode;
  home: string;
  sections: readonly { href: string; text: string; icon: LucideIcon }[];
}) {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useSession();
  const signOut = () =>
    logout.mutate(undefined, { onSettled: () => router.replace("/iniciar-sesion") });

  const links = sections.map(({ href, text, icon: Icon }) => (
    <li key={href}>
      <Link
        href={href}
        aria-current={path.startsWith(href) ? "page" : undefined}
        data-tour={`nav-${href.slice(1)}`}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
      >
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
        {text}
      </Link>
    </li>
  ));

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:hidden">
        <Link href={home} className="font-display text-2xl font-medium">
          Vetify
        </Link>
        {/* On phones the sections scroll sideways instead of widening the page. */}
        <nav
          aria-label="Portal"
          className="min-w-0 overflow-x-auto [scrollbar-width:none]"
        >
          <ul className="flex gap-1 whitespace-nowrap">{links}</ul>
        </nav>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border lg:flex">
        <div className="border-b border-border px-6 py-6">
          <Link href={home} className="font-display text-3xl font-medium">
            Vetify
          </Link>
          <p className="etiqueta mt-0.5 !text-primary">{label}</p>
          {subtitle && (
            <div className="mt-3 min-h-5 text-sm text-muted-foreground">{subtitle}</div>
          )}
        </div>
        <nav aria-label="Portal" className="px-3 py-5">
          <ul className="flex flex-col gap-1">{links}</ul>
        </nav>
        {/* Only with a loaded session (client side): the theme lives in the browser. */}
        {user && (
          <div className="mt-auto px-6 py-4">
            <ThemePicker compact />
          </div>
        )}
        {user && (
          <div className="flex items-center gap-3 border-t border-border px-6 py-4">
            <span className="flex size-9 items-center justify-center rounded-full border border-border text-xs">
              {initials(user.name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{user.name}</span>
            <button
              type="button"
              onClick={signOut}
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
