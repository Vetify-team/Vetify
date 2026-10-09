"use client";

import { useRouter } from "next/navigation";
import { Fila, Seccion, TituloPantalla } from "@/components/sistema";
import { Button } from "@/components/ui/button";
import { useSesion } from "@/hooks/useSesion";
import { SelectorTema } from "@/components/selector-tema";

/** Cuenta, apariencia y cierre de sesión. */
export function Ajustes() {
  const { usuario, cerrarSesion } = useSesion();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-8">
      <TituloPantalla etiqueta="Tu cuenta" titulo="Ajustes" />

      {usuario && (
        <Seccion titulo="Cuenta">
          <Fila
            titulo="Nombre"
            derecha={<span className="text-sm">{usuario.nombre}</span>}
          />
          <Fila
            titulo="Correo"
            derecha={<span className="text-sm">{usuario.correo}</span>}
          />
          <Fila
            titulo="Plan"
            derecha={<span className="text-sm text-muted-foreground">Gratuito</span>}
          />
        </Seccion>
      )}

      <Seccion titulo="Apariencia">
        <div className="pt-4">
          <SelectorTema />
        </div>
      </Seccion>

      <Button
        variant="outline"
        disabled={cerrarSesion.isPending}
        onClick={() =>
          cerrarSesion.mutate(undefined, {
            onSettled: () => router.replace("/iniciar-sesion"),
          })
        }
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
