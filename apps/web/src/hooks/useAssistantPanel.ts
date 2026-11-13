"use client";

import { create } from "zustand";

/**
 * The one assistant panel of the owner and clinic areas: open or closed, and
 * for which pet. Every entry (the floating button, the pet's profile, the
 * patient's file) opens this same panel. Nothing is stored in the browser.
 */
export const useAssistantPanel = create<{
  open: boolean;
  petId: string | null;
  show: (petId: string | null) => void;
  hide: () => void;
  choose: (petId: string) => void;
}>()((set) => ({
  open: false,
  petId: null,
  show: (petId) => set((state) => ({ open: true, petId: petId ?? state.petId })),
  hide: () => set({ open: false }),
  choose: (petId) => set({ petId }),
}));
