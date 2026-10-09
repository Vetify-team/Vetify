"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OtorgarPermiso } from "@vetify/types";
import { api } from "../lib/api-client";
import { claves } from "./claves";

export function usePermisos(mascotaId: string) {
  return useQuery({
    queryKey: claves.permisos(mascotaId),
    queryFn: () => api.permisos(mascotaId),
  });
}

export function useBitacora(mascotaId: string) {
  return useQuery({
    queryKey: claves.bitacora(mascotaId),
    queryFn: () => api.bitacora(mascotaId),
  });
}

export function useBuscarClinicas(busqueda: string) {
  return useQuery({
    queryKey: claves.clinicas(busqueda),
    queryFn: () => api.buscarClinicas(busqueda),
    enabled: busqueda.trim().length >= 2,
  });
}

export function useMiClinica() {
  return useQuery({ queryKey: claves.miClinica, queryFn: () => api.miClinica() });
}

export function useGestionPermisos(mascotaId: string) {
  const clienteQuery = useQueryClient();
  const alCambiar = () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: claves.permisos(mascotaId) }),
      clienteQuery.invalidateQueries({ queryKey: claves.bitacora(mascotaId) }),
    ]);

  return {
    otorgar: useMutation({
      mutationFn: (datos: OtorgarPermiso) => api.otorgarPermiso(mascotaId, datos),
      onSuccess: alCambiar,
    }),
    revocar: useMutation({
      mutationFn: (permisoId: string) => api.revocarPermiso(mascotaId, permisoId),
      onSuccess: alCambiar,
    }),
  };
}
