"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The pet the owner opened last. The "Esquema" and "Carné" tabs use it to
 * know whose data to show. A navigation convenience: if lost, the first pet
 * is used. Only an id is stored, no health data.
 */
export const useCurrentPet = create<{
  id: string | null;
  select: (id: string) => void;
}>()(
  persist((set) => ({ id: null, select: (id) => set({ id }) }), {
    name: "vetify:current-pet",
    storage: createJSONStorage(() => localStorage),
  }),
);
