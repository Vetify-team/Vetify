"use client";

import {
  Bell,
  BookOpen,
  CreditCard,
  LogOut,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";
import { PlanPanel } from "@/components/billing/plan-panel";
import { PetAvatar } from "@/components/pets/pet-photo";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { usePets } from "@/hooks/usePets";
import { useSession } from "@/hooks/useSession";
import { LANDING_PAGES, siteHref } from "@/lib/sites";
import { requestTourReplay } from "@/lib/tour";
import { CloseAccount } from "./close-account";
import { EmailSettings } from "./email-settings";
import { PushSettings } from "./push-settings";

const card =
  "rounded-3xl bg-card shadow-[0_1px_2px_rgba(29,27,24,0.06),0_8px_24px_rgba(29,27,24,0.05)] dark:shadow-none dark:ring-1 dark:ring-border";

const SECTIONS = [
  { id: "cuenta", title: "Cuenta", icon: UserRound },
  { id: "plan", title: "Plan", icon: CreditCard },
  { id: "notificaciones", title: "Notificaciones", icon: Bell },
  { id: "privacidad", title: "Privacidad y datos", icon: ShieldCheck },
  { id: "ayuda", title: "Ayuda", icon: BookOpen },
  { id: "sesion", title: "Sesión", icon: LogOut },
] as const;

/**
 * The owner's settings: a card per topic with a line saying what it is for,
 * an index beside them on desktop, and closing the account apart at the end.
 */
export function Settings() {
  const { user, logout } = useSession();
  const pets = usePets(!!user);
  const router = useRouter();

  return (
    <div data-wide className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
          Ajustes
        </h1>
        {user && <p className="mt-1 text-muted-foreground">{user.email}</p>}
      </header>

      <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Secciones de ajustes" className="hidden md:block">
          <ul className="sticky top-8 flex flex-col gap-1">
            {[
              ...SECTIONS,
              { id: "riesgo", title: "Zona de riesgo", icon: TriangleAlert },
            ].map(({ id, title, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    id === "riesgo" && "mt-4 text-alert hover:text-alert",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden /> {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          {user && (
            <SettingsCard
              id="cuenta"
              icon={UserRound}
              title="Cuenta"
              description="Tus datos para entrar a Vetify y cómo se ve la app."
            >
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Nombre</dt>
                  <dd className="truncate">{user.name}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Correo</dt>
                  <dd className="truncate">{user.email}</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Apariencia</p>
                <ThemePicker />
              </div>
            </SettingsCard>
          )}

          {user && (
            <SettingsCard
              id="plan"
              icon={CreditCard}
              title="Plan"
              description="Lo que incluye tu plan y cómo pasarte a Premium."
            >
              <PlanPanel role="owner" bare />
            </SettingsCard>
          )}

          <SettingsCard
            id="notificaciones"
            icon={Bell}
            title="Notificaciones"
            description="Cómo te avisamos de vacunas, desparasitaciones y cambios de peso."
          >
            <div className="flex flex-col gap-1">
              <p className="font-medium">En este teléfono</p>
              <PushSettings bare />
            </div>
            {user && (
              <div className="flex flex-col gap-1 border-t border-border/70 pt-4">
                <p className="font-medium">Por correo</p>
                <EmailSettings bare />
              </div>
            )}
          </SettingsCard>

          <SettingsCard
            id="privacidad"
            icon={ShieldCheck}
            title="Privacidad y datos"
            description="El expediente es tuyo: revisá qué clínica ve cada mascota y qué guardamos."
          >
            {pets.data && pets.data.length > 0 && (
              <ul className="flex flex-col gap-2">
                {pets.data.map((pet) => (
                  <li key={pet.id}>
                    <Link
                      href={`/mascotas/${pet.id}/permisos`}
                      className="flex items-center gap-3 rounded-2xl bg-background/70 p-3 transition-colors hover:bg-muted"
                    >
                      <PetAvatar pet={pet} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{pet.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          Quién puede ver su expediente
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <a
              href={`${siteHref("landing", LANDING_PAGES.terms)}#datos`}
              className="w-fit text-sm text-primary underline underline-offset-4"
            >
              Qué datos guardamos y para qué
            </a>
          </SettingsCard>

          <SettingsCard
            id="ayuda"
            icon={BookOpen}
            title="Ayuda"
            description="El manual paso a paso y el recorrido por la app."
          >
            <div className="flex flex-wrap gap-2">
              <a
                href={siteHref("landing", `${LANDING_PAGES.help}/duenos`)}
                className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                Abrir el manual
              </a>
              {user && (
                <Button
                  variant="outline"
                  onClick={() => {
                    requestTourReplay(user.id);
                    router.push("/mascotas");
                  }}
                >
                  Ver el recorrido de nuevo
                </Button>
              )}
            </div>
          </SettingsCard>

          <SettingsCard
            id="sesion"
            icon={LogOut}
            title="Sesión"
            description="Salí de Vetify en este dispositivo. Tus datos quedan guardados."
          >
            <Button
              variant="outline"
              className="w-fit"
              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSettled: () => router.replace("/iniciar-sesion"),
                })
              }
            >
              <LogOut aria-hidden /> Cerrar sesión
            </Button>
          </SettingsCard>

          {user?.role === "owner" && (
            <section
              id="riesgo"
              aria-labelledby="riesgo-title"
              className="mt-6 flex scroll-mt-8 flex-col gap-3 rounded-3xl border-2 border-alert/40 bg-alert/5 p-5 sm:p-6"
            >
              <h2
                id="riesgo-title"
                className="flex items-center gap-2 font-display text-2xl text-alert"
              >
                <TriangleAlert className="size-5" aria-hidden /> Zona de riesgo
              </h2>
              <CloseAccount bare />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(card, "flex scroll-mt-8 flex-col gap-5 p-5 sm:p-6")}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <h2 id={`${id}-title`} className="font-display text-2xl leading-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
