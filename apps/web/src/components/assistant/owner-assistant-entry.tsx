"use client";

import type { Pet } from "@vetify/types";
import { ChevronRight, Sparkles } from "lucide-react";
import { useAssistantUsage } from "@/hooks/useAssistant";
import { usageLabel } from "@/lib/assistant";
import { AssistantSheet } from "./assistant-sheet";

/** The owner's door to the assistant, on the pet's profile. */
export function OwnerAssistantEntry({ pet }: { pet: Pet }) {
  const usage = useAssistantUsage(pet.id);
  const label = usageLabel(usage.data);

  return (
    <AssistantSheet
      petId={pet.id}
      petName={pet.name}
      mode="owner"
      trigger={
        <button
          type="button"
          className="group flex w-full items-center gap-4 rounded-lg border border-primary bg-primary/5 px-4 py-4 text-left transition-colors outline-none hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary text-primary"
          >
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl font-medium">
              Preguntale a Vetify
            </span>
            <span className="block text-xs text-muted-foreground">
              Vacunas, peso, comida: te respondo con el expediente de {pet.name}.
            </span>
            {label && (
              <span className="mt-1 block text-xs font-medium text-foreground">
                {label}
              </span>
            )}
          </span>
          <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden />
        </button>
      }
    />
  );
}
