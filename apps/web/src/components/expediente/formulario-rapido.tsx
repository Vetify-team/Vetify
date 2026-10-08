"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { ErrorFormulario } from "@/components/campos";
import { Button } from "@/components/ui/button";
import {
  erroresDeApi,
  mensajeDeError,
  validarFormulario,
  type ErroresDeCampo,
} from "@/lib/formularios";

type Esquema<T> = Parameters<typeof validarFormulario<T>>[1];

/**
 * Tarjeta con un formulario corto que valida con un esquema de @vetify/types,
 * llama a una mutación y se limpia al guardar.
 */
export function FormularioRapido<T>({
  titulo,
  esquema,
  mutacion,
  transformar,
  textoBoton = "Guardar",
  children,
  alGuardar,
}: {
  titulo?: string;
  alGuardar?: () => void;
  esquema: Esquema<T>;
  mutacion: UseMutationResult<unknown, unknown, T>;
  transformar?: (datos: Record<string, unknown>) => Record<string, unknown>;
  textoBoton?: string;
  children: (errores: ErroresDeCampo) => ReactNode;
}) {
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const [guardado, setGuardado] = useState(false);

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const { datos, errores } = validarFormulario(formulario, esquema, transformar);
    setErrores(errores ?? {});
    setGuardado(false);
    if (!datos) return;
    mutacion.mutate(datos, {
      onSuccess: () => {
        formulario.reset();
        setGuardado(true);
        alGuardar?.();
      },
      onError: (error) => setErrores(erroresDeApi(error)),
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {titulo && <h3 className="titulo-seccion">{titulo}</h3>}
      {children(errores)}
      <ErrorFormulario
        mensaje={mutacion.isError ? mensajeDeError(mutacion.error) : null}
      />
      {guardado && (
        <p role="status" className="text-sm text-muted-foreground">
          ✓ Guardado en el expediente.
        </p>
      )}
      <Button type="submit" disabled={mutacion.isPending}>
        {mutacion.isPending ? "Guardando…" : textoBoton}
      </Button>
    </form>
  );
}
