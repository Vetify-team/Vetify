"use client";

import type { Pet } from "@vetify/types";
import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { cn } from "cn";
import { speciesLabel } from "@/lib/labels";
import { PetAvatar } from "./pet-photo";

/**
 * Which pet a screen or panel is about. A native select, so it works with
 * the keyboard, screen readers and the iPhone wheel; the chosen pet's photo
 * sits next to it.
 */
export function PetPicker({
  pets,
  value,
  onChange,
  label = "Mascota",
  placeholder = "Elegí una mascota",
  className,
}: {
  pets: Pet[];
  value: string | null;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const selected = pets.find((p) => p.id === value);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {selected ? (
        <PetAvatar pet={selected} size="sm" />
      ) : (
        <span aria-hidden className="size-10 shrink-0 rounded-full bg-muted" />
      )}
      <div className="relative min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          className="h-11 w-full min-w-0 appearance-none truncate rounded-xl border border-input bg-card pr-10 pl-3.5 font-display text-xl outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {!selected && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name} · {pet.breed ?? speciesLabel[pet.species]}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}
