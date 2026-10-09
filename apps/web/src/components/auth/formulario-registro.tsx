"use client";

import { registrarUsuarioSchema, type RolUsuario } from "@vetify/types";
import { Building2, PawPrint } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Campo, ErrorFormulario } from "@/components/campos";
import { inicioDeRol } from "@/components/ruta-protegida";
import { Button } from "@/components/ui/button";
import { useSesion } from "@/hooks/useSesion";
import {
  erroresDeApi,
  mensajeDeError,
  validarFormulario,
  type ErroresDeCampo,
} from "@/lib/formularios";

const ROLES: { rol: RolUsuario; texto: string; icono: typeof PawPrint }[] = [
  { rol: "dueño", texto: "Tengo mascotas", icono: PawPrint },
  { rol: "clinica", texto: "Soy una clínica", icono: Building2 },
];

export function FormularioRegistro() {
  const { registrar } = useSesion();
  const router = useRouter();
  const [rol, setRol] = useState<RolUsuario>("dueño");
  const [errores, setErrores] = useState<ErroresDeCampo>({});

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const { datos, errores } = validarFormulario(
      evento.currentTarget,
      registrarUsuarioSchema,
      (d) => ({
        ...d,
        rol,
      }),
    );
    setErrores(errores ?? {});
    if (!datos) return;
    registrar.mutate(datos, {
      onSuccess: (sesion) => router.replace(inicioDeRol(sesion.usuario.rol)),
      onError: (error) => setErrores(erroresDeApi(error)),
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <h1 className="titulo-seccion">Crear cuenta</h1>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Tipo de cuenta</legend>
        {ROLES.map(({ rol: opcion, texto, icono: Icono }) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={rol === opcion}
            onClick={() => setRol(opcion)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-2 text-sm text-muted-foreground transition-colors aria-pressed:border-foreground aria-pressed:text-foreground"
          >
            <Icono className="size-4" aria-hidden /> {texto}
          </button>
        ))}
      </fieldset>

      {rol === "clinica" && (
        <Campo
          etiqueta="Nombre de la clínica"
          nombre="nombreClinica"
          error={errores.nombreClinica}
        />
      )}
      <Campo
        etiqueta={rol === "clinica" ? "Tu nombre (responsable)" : "Nombre"}
        nombre="nombre"
        autoComplete="name"
        error={errores.nombre}
      />
      <Campo
        etiqueta="Correo"
        nombre="correo"
        type="email"
        autoComplete="email"
        error={errores.correo}
      />
      <Campo
        etiqueta="Teléfono (opcional)"
        nombre="telefono"
        type="tel"
        autoComplete="tel"
        error={errores.telefono}
      />
      <Campo
        etiqueta="Contraseña"
        nombre="contrasena"
        type="password"
        autoComplete="new-password"
        error={errores.contrasena}
        ayuda="Al menos 10 caracteres."
      />
      <ErrorFormulario
        mensaje={registrar.isError ? mensajeDeError(registrar.error) : null}
      />
      <Button type="submit" size="lg" disabled={registrar.isPending}>
        {registrar.isPending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/iniciar-sesion"
          className="text-primary underline underline-offset-4"
        >
          Iniciá sesión
        </Link>
      </p>
    </form>
  );
}
