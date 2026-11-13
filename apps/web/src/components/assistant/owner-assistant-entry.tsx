"use client";

import type { Pet } from "@vetify/types";
import { ChevronRight } from "lucide-react";
import { useAssistantUsage } from "@/hooks/useAssistant";
import { useAssistantPanel } from "@/hooks/useAssistantPanel";
import { usageLabel } from "@/lib/assistant";
import { AssistantIcon } from "./assistant-icon";

/** The owner's door to the assistant on the pet's panel: opens the shared panel with this pet. */
export function OwnerAssistantEntry({ pet }: { pet: Pet }) {
  const usage = useAssistantUsage(pet.id);
  const show = useAssistantPanel((s) => s.show);
  const label = usageLabel(usage.data);

  return (
    <button
      type="button"
      onClick={() => show(pet.id)}
      className="group flex w-full items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-[0_8px_24px_rgba(138,92,20,0.25)] transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-ring/50 dark:shadow-none"
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15"
      >
        <AssistantIcon className="size-6" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl leading-tight font-medium">
          Preguntale a Vetify
        </span>
        <span className="block text-sm text-primary-foreground/80">
          Vacunas, peso, comida: te respondo con el expediente de {pet.name}.
        </span>
        {label && (
          <span className="mt-1 block text-xs font-medium text-primary-foreground/90">
            {label}
          </span>
        )}
      </span>
      <ChevronRight className="size-5 shrink-0 opacity-80" aria-hidden />
    </button>
  );
}
