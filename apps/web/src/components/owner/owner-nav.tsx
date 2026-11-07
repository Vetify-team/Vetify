"use client";

import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/hooks/keys";
import { api } from "@/lib/api-client";
import { Bell, CalendarDays, QrCode, Settings, User } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { OwnerPageSkeleton, ownerSkeletonForPath } from "./owner-page-skeleton";
import { cn } from "cn";
import { useCurrentPet } from "@/hooks/useCurrentPet";
import { usePets } from "@/hooks/usePets";
import { useSession } from "@/hooks/useSession";
import { ownerTabHref } from "@/lib/owner-navigation";

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
/** Show feedback as soon as Next starts fetching the selected route. */
function PendingScreen({
  pending,
  href,
  petId,
}: {
  pending: boolean;
  href: string;
  petId?: string;
}) {
  const client = useQueryClient();
  const pets = client.getQueryData<Awaited<ReturnType<typeof api.pets>>>(keys.pets());
  const alerts = client.getQueryData<Awaited<ReturnType<typeof api.alerts>>>(keys.alerts);
  const schedule = petId
    ? client.getQueryData<Awaited<ReturnType<typeof api.vaccinationStatus>>>(
        keys.vaccinationStatus(petId),
      )
    : undefined;
  const notifications = client.getQueryData<
    Awaited<ReturnType<typeof api.notifications>>
  >(["notifications"]);
  const cardLink = petId
    ? client.getQueryData<Awaited<ReturnType<typeof api.cardLink>>>(["card-link", petId])
    : undefined;
  const pet = pets?.find((item) => item.id === petId);
  const hasCalendar = alerts?.some((alert) => alert.petId === petId && !!alert.dueOn);
  const upcomingCount = alerts
    ?.filter((alert) => alert.status !== "not_yet_due")
    .slice(0, 3).length;
  if (!pending) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-10 bg-background md:left-56"
      role="status"
      aria-label="Cargando pantalla"
    >
      <div className="mx-auto w-full max-w-xl px-5 pt-8">
        <OwnerPageSkeleton
          page={ownerSkeletonForPath(href)}
          petCount={pets?.length}
          upcomingCount={upcomingCount}
          schedule={schedule}
          hasCalendar={hasCalendar}
          alertData={alerts}
          notifications={notifications}
          hasQr={Boolean(cardLink?.token)}
          hasMicrochip={Boolean(pet?.microchip)}
        />
      </div>
    </div>,
    document.body,
  );
}

function DesktopPendingScreen({ href, petId }: { href: string; petId?: string }) {
  const { pending } = useLinkStatus();
  return <PendingScreen pending={pending} href={href} petId={petId} />;
}

function TabContent({
  icon: Icon,
  text,
  href,
  petId,
}: {
  icon: typeof User;
  text: string;
  href: string;
  petId?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      <Icon
        className={cn("size-5", pending && "animate-pulse")}
        strokeWidth={1.5}
        aria-hidden
      />
      <span>{text}</span>
      <PendingScreen pending={pending} href={href} petId={petId} />
    </>
  );
}

export function OwnerNav() {
  const active = activeTab(usePathname());
  const { user } = useSession();
  const { data: pets } = usePets(user?.role === "owner");
  const currentPet = useCurrentPet((state) => state.id);
  const selectedPet =
    user?.role === "owner"
      ? (pets?.find((pet) => pet.id === currentPet) ?? pets?.[0])
      : undefined;

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 mx-auto max-w-xl rounded-full border border-border/80 bg-card/85 p-1.5 shadow-[0_8px_30px_rgba(29,27,24,0.18)] backdrop-blur-xl md:hidden dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
      >
        <ul className="grid grid-cols-5 items-center">
          {TABS.map(({ href, text, icon: Icon }) => (
            <li key={href} className="min-w-0">
              <Link
                href={ownerTabHref(href, selectedPet?.id)}
                prefetch
                aria-current={active === href ? "page" : undefined}
                data-tour={`nav-${href.slice(1)}`}
                className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-full px-0.5 py-1.5 text-[0.625rem] leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary/15 aria-[current=page]:font-semibold aria-[current=page]:text-primary"
              >
                <TabContent icon={Icon} text={text} href={href} petId={selectedPet?.id} />
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
                  href={ownerTabHref(href, selectedPet?.id)}
                  prefetch
                  aria-current={active === href ? "page" : undefined}
                  data-tour={`nav-${href.slice(1)}`}
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
                  <DesktopPendingScreen href={href} petId={selectedPet?.id} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
