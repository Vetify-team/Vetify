"use client";

import type { AssistantMode } from "@vetify/types";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { cn } from "cn";
import { PetPicker } from "@/components/pets/pet-picker";
import { LoadError, LoadingList } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAssistantPanel } from "@/hooks/useAssistantPanel";
import { usePets } from "@/hooks/usePets";
import { choosePet, petOnScreen } from "@/lib/assistant";
import { AssistantChat } from "./assistant-chat";
import { AssistantIcon } from "./assistant-icon";

const COPY: Record<
  AssistantMode,
  {
    title: string;
    picker: string;
    empty: string;
    hint: string;
    action: { href: string; text: string };
  }
> = {
  owner: {
    title: "Preguntale a Vetify",
    picker: "¿Sobre qué mascota?",
    empty: "Todavía no registraste ninguna mascota.",
    hint: "El asistente responde con su expediente: registrala y volvé.",
    action: { href: "/mascotas/nueva", text: "Registrar mascota" },
  },
  clinic: {
    title: "Asistente clínico",
    picker: "Paciente",
    empty: "Todavía no tenés pacientes vinculados.",
    hint: "Generá un código para que el dueño te dé acceso a su expediente.",
    action: { href: "/codigo", text: "Generar código de vinculación" },
  },
};

/**
 * The assistant everywhere in the owner and clinic areas: a floating button
 * (above the owner's tab bar and the iPhone's home indicator) and one panel
 * with a pet picker. On a pet's or patient's screen it opens with that pet;
 * with a single pet, with that one. Changing the pet starts a new
 * conversation. The profile and patient entries open this same panel.
 */
export function AssistantDock({ mode }: { mode: AssistantMode }) {
  const { open, petId, show, hide, choose } = useAssistantPanel();
  const pets = usePets();
  const path = usePathname();
  const input = useRef<HTMLTextAreaElement>(null);
  const copy = COPY[mode];

  const ids = pets.data?.map((p) => p.id) ?? [];
  const onScreen = petOnScreen(path);
  // A pet that is no longer visible (revoked, closed) is never kept.
  const selected = choosePet(ids, { previous: petId });

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => show(choosePet(ids, { onScreen, previous: petId }))}
          aria-label="Abrir el asistente"
          className={cn(
            "fixed right-4 z-30 flex items-center gap-2 rounded-full bg-primary px-4 py-3.5 text-primary-foreground shadow-[0_10px_30px_rgba(138,92,20,0.35)] transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-ring/50 active:translate-y-0 dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]",
            mode === "owner"
              ? // Above the floating tab bar on phones; the corner on desktop.
                "bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] md:right-8 md:bottom-8"
              : "bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] lg:right-8 lg:bottom-8",
          )}
        >
          <AssistantIcon className="size-6" strokeWidth={1.75} />
          <span className="hidden text-sm font-medium sm:inline">Asistente</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={(next) => (next ? show(null) : hide())}>
        <SheetContent initialFocus={input}>
          <div className="flex flex-col gap-3 border-b border-border px-5 pt-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <AssistantIcon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-2xl">{copy.title}</SheetTitle>
                  <SheetDescription className="sr-only">
                    Responde con el expediente de la mascota elegida.
                  </SheetDescription>
                </div>
              </div>
              <SheetClose
                render={<Button variant="ghost" size="icon-lg" className="-mr-2" />}
              >
                <XIcon aria-hidden />
                <span className="sr-only">Cerrar el asistente</span>
              </SheetClose>
            </div>
            {pets.data && pets.data.length > 0 && (
              <PetPicker
                pets={pets.data}
                value={selected}
                onChange={choose}
                label={copy.picker}
                placeholder={copy.picker}
              />
            )}
          </div>

          {pets.isPending ? (
            <div className="px-5 py-6">
              <LoadingList rows={2} />
            </div>
          ) : pets.error ? (
            <div className="px-5 py-6">
              <LoadError error={pets.error} retry={() => void pets.refetch()} />
            </div>
          ) : pets.data.length === 0 ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-3 px-6 pb-16">
              <p className="font-display text-3xl leading-tight">{copy.empty}</p>
              <p className="text-sm text-muted-foreground">{copy.hint}</p>
              <Link
                href={copy.action.href}
                onClick={hide}
                className={buttonVariants({ variant: "solido" })}
              >
                {copy.action.text}
              </Link>
            </div>
          ) : selected ? (
            <AssistantChat petId={selected} mode={mode} inputRef={input} />
          ) : (
            <p className="px-6 py-10 text-muted-foreground">
              {mode === "owner"
                ? "Elegí arriba sobre qué mascota querés preguntar."
                : "Elegí arriba el paciente."}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
