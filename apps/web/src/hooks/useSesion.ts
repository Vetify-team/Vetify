"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IniciarSesion, RegistrarUsuario, Sesion } from "@vetify/types";
import { api } from "../lib/api-client";
import { claves } from "./claves";

/**
 * Sesión del usuario. Como el resto de hooks de esta carpeta, no importa nada
 * de `next/*`: es reutilizable tal cual desde apps/mobile.
 *
 * La sesión se lee como una query y no directo del almacenamiento para que el
 * primer render del servidor y el del navegador coincidan: mientras no se leyó,
 * `cargando` es true.
 */
export function useSesion() {
  const clienteQuery = useQueryClient();

  const consulta = useQuery({
    queryKey: claves.sesion,
    queryFn: () => api.sesion,
    staleTime: Infinity,
  });

  const alCambiarSesion = (sesion: Sesion | null) => {
    // La sesión anterior pudo cachear datos de otro usuario.
    clienteQuery.removeQueries({ predicate: (q) => q.queryKey[0] !== claves.sesion[0] });
    clienteQuery.setQueryData(claves.sesion, sesion);
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
    onSettled: () => alCambiarSesion(null),
  });

  const sesion = consulta.data ?? null;

  return {
    cargando: consulta.isPending,
    sesion,
    usuario: sesion?.usuario ?? null,
    estaAutenticado: sesion !== null,
    iniciarSesion,
    registrar,
    cerrarSesion,
  };
}
