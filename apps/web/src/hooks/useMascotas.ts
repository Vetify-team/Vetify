"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActualizarMascota, CrearMascota } from "@vetify/types";
import { api } from "../lib/api-client";
import { claves } from "./claves";

/** Mascotas del dueño, o pacientes con permiso activo si el usuario es clínica. */
export function useMascotas() {
  return useQuery({ queryKey: claves.mascotas(), queryFn: () => api.mascotas() });
}

export function useMascota(id: string) {
  return useQuery({ queryKey: claves.mascota(id), queryFn: () => api.mascota(id) });
}

export function useCrearMascota() {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearMascota) => api.crearMascota(datos),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: claves.mascotas() }),
  });
}

export function useActualizarMascota(id: string) {
  const clienteQuery = useQueryClient();
  return useMutation({
    mutationFn: (datos: ActualizarMascota) => api.actualizarMascota(id, datos),
    onSuccess: (mascota) => {
      clienteQuery.setQueryData(claves.mascota(id), mascota);
      return clienteQuery.invalidateQueries({ queryKey: claves.mascotas(), exact: true });
    },
  });
}
