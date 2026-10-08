"use client";

import { iniciarSesionSchema } from "@vetify/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Campo, ErrorFormulario } from "@/components/campos";
import { inicioDeRol } from "@/components/ruta-protegida";
import { Button } from "@/components/ui/button";
import { useSesion } from "@/hooks/useSesion";
import {
  mensajeDeError,
  validarFormulario,
  type ErroresDeCampo,
} from "@/lib/formularios";

export function FormularioIngreso() {
  const { iniciarSesion } = useSesion();
  const router = useRouter();
  const [errores, setErrores] = useState<ErroresDeCampo>({});

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const { datos, errores } = validarFormulario(
      evento.currentTarget,
      iniciarSesionSchema,
    );
    setErrores(errores ?? {});
    if (!datos) return;
    iniciarSesion.mutate(datos, {
      onSuccess: (sesion) => router.replace(inicioDeRol(sesion.usuario.rol)),
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <h1 className="titulo-seccion">Iniciar sesión</h1>
      <Campo
        etiqueta="Correo"
        nombre="correo"
        type="email"
        autoComplete="email"
        error={errores.correo}
      />
      <Campo
        etiqueta="Contraseña"
        nombre="contrasena"
        type="password"
        autoComplete="current-password"
        error={errores.contrasena}
      />
      <ErrorFormulario
        mensaje={iniciarSesion.isError ? mensajeDeError(iniciarSesion.error) : null}
      />
      <Button type="submit" size="lg" disabled={iniciarSesion.isPending}>
        {iniciarSesion.isPending ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="text-primary underline underline-offset-4">
          Registrate
        </Link>
      </p>
    </form>
  );
}
