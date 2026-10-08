"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Última mascota que abrió el dueño. Las pestañas "Esquema" y "Carné" la usan
 * para saber de quién mostrar. Es una comodidad de navegación: si se pierde,
 * se toma la primera mascota.
 */
export const useMascotaActual = create<{
  id: string | null;
  elegir: (id: string) => void;
}>()(
  persist((set) => ({ id: null, elegir: (id) => set({ id }) }), {
    name: "vetify:mascota-actual",
    storage: createJSONStorage(() => localStorage),
  }),
);
