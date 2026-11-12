"use client";

import type { AssistantMode } from "@vetify/types";
import { XIcon } from "lucide-react";
import { useRef, useState, type ReactElement } from "react";
import { Label } from "@/components/system";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AssistantChat } from "./assistant-chat";

/**
 * The assistant in a panel: on the right on a large screen, full screen on a
 * phone. The conversation survives closing the panel while the page is open,
 * and the input gets the focus when it opens.
 */
export function AssistantSheet({
  petId,
  petName,
  mode,
  trigger,
}: {
  petId: string;
  petName: string;
  mode: AssistantMode;
  /** The button that opens it. */
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent initialFocus={input}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 pt-4 pb-3">
          <div className="min-w-0">
            <Label>
              {mode === "clinic" ? "Asistente clínico" : "Preguntale a Vetify"}
            </Label>
            <SheetTitle className="truncate">{petName}</SheetTitle>
            <SheetDescription>
              {mode === "clinic"
                ? "Responde con el expediente del paciente."
                : "Responde con el expediente de tu mascota."}
            </SheetDescription>
          </div>
          <SheetClose
            render={<Button variant="ghost" size="icon-lg" className="-mr-2" />}
          >
            <XIcon aria-hidden />
            <span className="sr-only">Cerrar el asistente</span>
          </SheetClose>
        </div>
        <AssistantChat petId={petId} mode={mode} inputRef={input} />
      </SheetContent>
    </Sheet>
  );
}
