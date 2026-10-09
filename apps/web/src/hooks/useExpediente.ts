"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CrearConsulta,
  CrearDesparasitacion,
  CrearExamen,
  CrearRegistroAlimentacion,
  CrearRegistroPeso,
  CrearTratamiento,
  CrearVacuna,
} from "@vetify/types";
import { api } from "../lib/api-client";
import { claves } from "./claves";

export function useExpediente(mascotaId: string) {
  return useQuery({
    queryKey: claves.expediente(mascotaId),
    queryFn: () => api.expediente(mascotaId),
  });
}

/** Avisos de todas las mascotas del dueño, o de los pacientes de la clínica. */
export function useAvisos() {
  return useQuery({ queryKey: claves.avisos, queryFn: () => api.avisos() });
}

export function useVacunacion(mascotaId: string) {
  return useQuery({
    queryKey: claves.vacunacion(mascotaId),
    queryFn: () => api.vacunacion(mascotaId),
  });
}

/**
 * Registros del expediente. Cualquier alta invalida el expediente y el estado
 * de vacunación (una vacuna nueva cambia la cobertura) y la bitácora.
 */
export function useRegistrosExpediente(mascotaId: string) {
  const clienteQuery = useQueryClient();
  const alRegistrar = () =>
    Promise.all([
      clienteQuery.invalidateQueries({ queryKey: claves.expediente(mascotaId) }),
      clienteQuery.invalidateQueries({ queryKey: claves.vacunacion(mascotaId) }),
      clienteQuery.invalidateQueries({ queryKey: claves.bitacora(mascotaId) }),
      clienteQuery.invalidateQueries({ queryKey: claves.avisos }),
    ]);

  return {
    consulta: useMutation({
      mutationFn: (datos: CrearConsulta) => api.registrarConsulta(mascotaId, datos),
      onSuccess: alRegistrar,
    }),
    vacuna: useMutation({
      mutationFn: (datos: CrearVacuna) => api.registrarVacuna(mascotaId, datos),
      onSuccess: alRegistrar,
    }),
    desparasitacion: useMutation({
      mutationFn: (datos: CrearDesparasitacion) =>
        api.registrarDesparasitacion(mascotaId, datos),
      onSuccess: alRegistrar,
    }),
    tratamiento: useMutation({
      mutationFn: (datos: CrearTratamiento) => api.registrarTratamiento(mascotaId, datos),
      onSuccess: alRegistrar,
    }),
    examen: useMutation({
      mutationFn: (datos: CrearExamen) => api.registrarExamen(mascotaId, datos),
      onSuccess: alRegistrar,
    }),
    peso: useMutation({
      mutationFn: (datos: CrearRegistroPeso) => api.registrarPeso(mascotaId, datos),
      onSuccess: alRegistrar,
    }),
    alimentacion: useMutation({
      mutationFn: (datos: CrearRegistroAlimentacion) =>
        api.registrarAlimentacion(mascotaId, datos),
      onSuccess: alRegistrar,
    }),
  };
}
