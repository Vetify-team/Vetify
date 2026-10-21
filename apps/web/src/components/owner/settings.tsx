"use client";

import { useRouter } from "next/navigation";
import { Row, ScreenTitle, Section } from "@/components/system";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

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
          <Row
            title="Plan"
            right={<span className="text-sm text-muted-foreground">Gratuito</span>}
          />
        </Section>
      )}
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
