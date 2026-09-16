"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IniciarSesion, RegistrarUsuario, Sesion } from "@vetify/types";
import { api } from "../lib/api-client";
import { claves } from "./claves";

/**
 * Sesión del usuario. Como el resto de hooks de esta carpeta, no importa nada
 * de `next/*`: es reutilizable tal cual desde apps/mobile.
 */
export function useSesion() {
  const clienteQuery = useQueryClient();

  const alCambiarSesion = (sesion: Sesion | null) => {
    clienteQuery.setQueryData(claves.sesion, sesion);
    // La sesión anterior pudo cachear datos de otro usuario.
    void clienteQuery.invalidateQueries();
  };

  const iniciarSesion = useMutation({
    mutationFn: (datos: IniciarSesion) => api.iniciarSesion(datos),
    onSuccess: alCambiarSesion,
  });

  const registrar = useMutation({
    mutationFn: (datos: RegistrarUsuario) => api.registrar(datos),
    onSuccess: alCambiarSesion,
  });

  const cerrarSesion = useMutation({
    mutationFn: () => api.cerrarSesion(),
    onSuccess: () => alCambiarSesion(null),
  });

  return {
    sesion: api.sesion,
    usuario: api.sesion?.usuario ?? null,
    estaAutenticado: api.sesion !== null,
    iniciarSesion,
    registrar,
    cerrarSesion,
  };
}
