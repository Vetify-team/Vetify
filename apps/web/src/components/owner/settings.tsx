"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PAID_PLANS, type PaidPlanId } from "@vetify/types";
import {
  Bell,
  BookOpen,
  CreditCard,
  FileLock2,
  LogOut,
  Mail,
  Map,
  Palette,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PlanPanel } from "@/components/billing/plan-panel";
import {
  SettingsButton,
  SettingsGroup,
  SettingsLink,
  SettingsRow,
} from "@/components/settings-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useBillingStatus } from "@/hooks/useBilling";
import { usePets } from "@/hooks/usePets";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/api-client";
import { LANDING_PAGES, siteHref } from "@/lib/sites";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";
import { requestTourReplay } from "@/lib/tour";
import { CloseAccount } from "./close-account";
import { PushSettings } from "./push-settings";

const THEME_TEXT: Record<Theme, string> = {
  system: "Como el sistema",
  light: "Claro",
  dark: "Oscuro",
};

/** A row's detail opened in a dialog: the iPhone would push a screen. */
function DetailDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto rounded-2xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-medium">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The owner's settings in the manner of the iPhone's Settings: grouped
 * rounded lists, an icon per row, values and switches on the right, a note
 * under a group when it needs one, and the danger zone in its own group at
 * the end. Centered, at a comfortable width, on every screen.
 */
export function Settings() {
  const { user, logout } = useSession();
  const pets = usePets(!!user);
  const billing = useBillingStatus();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [open, setOpen] = useState<"plan" | "push" | null>(null);

  const client = useQueryClient();
  const email = useQuery({
    queryKey: ["email-reminders"],
    queryFn: () => api.emailReminders(),
  });
  const setEmail = useMutation({
    mutationFn: (enabled: boolean) => api.setEmailReminders(enabled),
    onSuccess: (data) => client.setQueryData(["email-reminders"], data),
  });
  const emailOn = setEmail.isPending ? setEmail.variables : email.data?.enabled;

  const plan = billing.data;
  const planName =
    plan && plan.plan in PAID_PLANS
      ? PAID_PLANS[plan.plan as PaidPlanId].name
      : "Gratuito";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7">
      <h1 className="font-display text-4xl leading-tight font-medium sm:text-5xl">
        Ajustes
      </h1>

      {user && (
        <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(29,27,24,0.06)] dark:ring-1 dark:ring-border">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-display text-2xl text-primary-foreground"
          >
            {user.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-2xl leading-tight">
              {user.name}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {user.email}
            </span>
          </span>
        </div>
      )}

      <SettingsGroup id="cuenta" title="Cuenta">
        <SettingsRow
          icon={Palette}
          tint="plum"
          label="Apariencia"
          control={
            <label className="relative">
              <span className="sr-only">Apariencia</span>
              <select
                value={theme}
                onChange={(event) => {
                  const next = event.target.value as Theme;
                  setTheme(next);
                  applyTheme(next);
                }}
                className="appearance-none bg-transparent py-1 pr-1 text-right text-sm text-muted-foreground outline-none focus-visible:text-foreground"
              >
                {(Object.keys(THEME_TEXT) as Theme[]).map((value) => (
                  <option key={value} value={value}>
                    {THEME_TEXT[value]}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      </SettingsGroup>

      {user && (
        <SettingsGroup
          id="plan"
          title="Plan"
          note="Los pagos se procesan en ONVO: Vetify no ve ni guarda los datos de tu tarjeta."
        >
          <SettingsButton
            icon={CreditCard}
            tint="gold"
            label="Tu plan"
            value={billing.isPending ? "…" : planName}
            onClick={() => setOpen("plan")}
          />
        </SettingsGroup>
      )}

      <SettingsGroup
        id="notificaciones"
        title="Notificaciones"
        note="Te avisamos cuando se acerca una vacuna o desparasitación, o cuando el peso cambia de golpe. El aviso no muestra datos de tu mascota en la pantalla bloqueada."
      >
        <SettingsButton
          icon={Bell}
          tint="red"
          label="Avisos en este teléfono"
          onClick={() => setOpen("push")}
        />
        {user && (
          <SettingsRow
            icon={Mail}
            tint="blue"
            label="Recordatorios por correo"
            detail={
              email.isError || setEmail.isError
                ? "No se pudo guardar. Intentá de nuevo."
                : undefined
            }
            control={
              <Switch
                checked={emailOn ?? false}
                disabled={email.isPending || setEmail.isPending}
                onCheckedChange={(value) => setEmail.mutate(value)}
                aria-label="Recordatorios por correo"
              />
            }
          />
        )}
      </SettingsGroup>

      <SettingsGroup
        id="privacidad"
        title="Privacidad y datos"
        note="El expediente es tuyo: solo lo ven las clínicas a las que les das acceso, y podés quitárselo cuando quieras."
      >
        {pets.data?.map((pet) => (
          <SettingsLink
            key={pet.id}
            href={`/mascotas/${pet.id}/permisos`}
            icon={ShieldCheck}
            tint="green"
            label={`Quién puede ver a ${pet.name}`}
          />
        ))}
        <SettingsLink
          href={`${siteHref("landing", LANDING_PAGES.terms)}#datos`}
          external
          icon={FileLock2}
          tint="gray"
          label="Qué datos guardamos y para qué"
        />
      </SettingsGroup>

      <SettingsGroup id="ayuda" title="Ayuda">
        <SettingsLink
          href={siteHref("landing", `${LANDING_PAGES.help}/duenos`)}
          external
          icon={BookOpen}
          tint="amber"
          label="Manual de Vetify"
        />
        {user && (
          <SettingsButton
            icon={Map}
            tint="blue"
            label="Ver el recorrido de nuevo"
            onClick={() => {
              requestTourReplay(user.id);
              router.push("/mascotas");
            }}
          />
        )}
      </SettingsGroup>

      <SettingsGroup
        id="sesion"
        title="Sesión"
        note="Tus datos quedan guardados; volvés a entrar con tu correo."
      >
        <SettingsButton
          icon={LogOut}
          tint="gray"
          label="Cerrar sesión"
          chevron={false}
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSettled: () => router.replace("/iniciar-sesion"),
            })
          }
        />
      </SettingsGroup>

      {user?.role === "owner" && (
        <SettingsGroup
          id="riesgo"
          title="Zona de riesgo"
          note="Borra tu cuenta, tus mascotas con todo su expediente, los permisos que diste, tus avisos y tus pagos. No se puede deshacer."
        >
          <CloseAccount
            trigger={
              <SettingsButton
                icon={Trash2}
                tint="red"
                label="Cerrar mi cuenta"
                destructive
              />
            }
          />
        </SettingsGroup>
      )}

      <DetailDialog
        open={open === "plan"}
        onOpenChange={(next) => !next && setOpen(null)}
        title="Tu plan"
        description="Lo que incluye y cómo pasarte a Premium."
      >
        <PlanPanel role="owner" bare />
      </DetailDialog>
      <DetailDialog
        open={open === "push"}
        onOpenChange={(next) => !next && setOpen(null)}
        title="Avisos en este teléfono"
        description="Notificaciones de Vetify en este dispositivo."
      >
        <PushSettings bare />
      </DetailDialog>
    </div>
  );
}
