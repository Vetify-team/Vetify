"use client";

import { EmailSettings } from "./email-settings";
import { PushSettings } from "./push-settings";
import { useRouter } from "next/navigation";
import { Row, ScreenTitle, Section } from "@/components/system";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { PlanPanel } from "@/components/billing/plan-panel";
import { requestTourReplay } from "@/lib/tour";

/** Account, appearance and log out. */
export function Settings() {
  const { user, logout } = useSession();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle label="Tu cuenta" title="Ajustes" />
      {user && (
        <Section title="Cuenta">
          <Row title="Nombre" right={<span className="text-sm">{user.name}</span>} />
          <Row title="Correo" right={<span className="text-sm">{user.email}</span>} />
        </Section>
      )}
      {user && <PlanPanel role="owner" />}
      {user && (
        <Section title="Ayuda">
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => {
                requestTourReplay(user.id);
                router.push("/mascotas");
              }}
            >
              Ver el recorrido de nuevo
            </Button>
          </div>
        </Section>
      )}
      <PushSettings />
      {user && <EmailSettings />}
      <Section title="Apariencia">
        <div className="pt-4">
          <ThemePicker />
        </div>
      </Section>
      <Button
        variant="outline"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, { onSettled: () => router.replace("/iniciar-sesion") })
        }
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
