"use client";

import type { AssistantMode } from "@vetify/types";
import { Check, Copy, RotateCcw, SendHorizontal, Siren } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAssistant, useAssistantUsage } from "@/hooks/useAssistant";
import {
  buildHistory,
  canSend,
  charsLeft,
  FOOTER,
  isSendKey,
  MAX_CHARS,
  plainText,
  QUICK_ACTIONS,
  usageLabel,
  type ChatEntry,
  type QuickAction,
} from "@/lib/assistant";
import { assistantError, type AssistantError } from "@/lib/errors";
import { AssistantMarkdown } from "./assistant-markdown";

interface ChatProps {
  petId: string;
  mode: AssistantMode;
  /** The input, so a panel can focus it when it opens. */
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

/**
 * The pet assistant's conversation. It lives only in this component's state
 * (never in storage): it starts over with another pet and with
 * "Nueva conversación".
 */
export function AssistantChat(props: ChatProps) {
  return <Conversation key={props.petId} {...props} />;
}

const newId = () => crypto.randomUUID();

function Conversation({ petId, mode, inputRef }: ChatProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<(AssistantError & { copyable?: boolean }) | null>(
    null,
  );
  const assistant = useAssistant(petId);
  const usage = useAssistantUsage(petId, mode === "owner");
  // Answers of a conversation that was started over are dropped.
  const generation = useRef(0);
  const ownInput = useRef<HTMLTextAreaElement>(null);
  const input = inputRef ?? ownInput;
  const end = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);

  const pending = assistant.isPending;
  const left = charsLeft(draft);

  // A new answer shows from its first line (a long one would otherwise open
  // at its end); a question, "Escribiendo…" or an error, at the bottom.
  const last = entries.at(-1);
  useEffect(() => {
    const target =
      last?.role === "assistant" && !pending && !error
        ? log.current?.querySelector(`[data-entry="${last.id}"]`)
        : end.current;
    target?.scrollIntoView({
      block: target === end.current ? "end" : "start",
      behavior: "smooth",
    });
  }, [last, pending, error]);

  const ask = (history: ChatEntry[], copyable?: boolean) => {
    const sentIn = generation.current;
    setError(null);
    assistant.mutate(buildHistory(history), {
      onSuccess: (answer) => {
        if (sentIn !== generation.current) return;
        setEntries((current) => [
          ...current,
          {
            id: newId(),
            role: "assistant",
            content: answer.reply,
            urgent: answer.urgent,
            copyable,
          },
        ]);
      },
      onError: (failure) => {
        if (sentIn !== generation.current) return;
        setError({
          ...assistantError(failure, usage.data?.limit ?? null),
          copyable,
        });
      },
    });
  };

  const send = (text: string, action?: QuickAction) => {
    if (!canSend(text, pending)) return;
    const entry: ChatEntry = {
      id: newId(),
      role: "user",
      content: text.trim(),
      display: action?.prompt ? action.label : undefined,
    };
    const history = [...entries, entry];
    setEntries(history);
    if (!action) setDraft("");
    ask(history, action?.copyable);
    input.current?.focus();
  };

  const startOver = () => {
    generation.current += 1;
    assistant.reset();
    setEntries([]);
    setError(null);
    setDraft("");
    input.current?.focus();
  };

  const label = usageLabel(usage.data);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2 text-xs text-muted-foreground">
        <span aria-live="polite">{label ?? " "}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={startOver}
          disabled={!entries.length && !error}
        >
          <RotateCcw aria-hidden /> Nueva conversación
        </Button>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversación con el asistente"
        ref={log}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5"
      >
        {!entries.length && (
          <p className="text-sm text-muted-foreground">
            {mode === "clinic"
              ? "Preguntá sobre el expediente del paciente o usá un acceso rápido."
              : "Preguntá lo que quieras sobre la salud y el cuidado de tu mascota. Uso su expediente para responderte."}
          </p>
        )}
        {entries.map((entry) => (
          <Bubble key={entry.id} entry={entry} mode={mode} />
        ))}
        {pending && (
          <p className="w-fit border-l-2 border-border pl-3 text-sm text-muted-foreground italic">
            Escribiendo…
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 border-l-2 border-foreground py-1 pl-3 text-sm"
          >
            <p>{error.message}</p>
            <div className="flex flex-wrap gap-2">
              {error.upgrade && (
                <Link href="/ajustes" className={buttonVariants({ size: "sm" })}>
                  Ver el plan Premium
                </Link>
              )}
              {error.retry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ask(entries, error.copyable)}
                >
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-5 pt-3 pb-4">
        <div className="flex flex-wrap gap-2" aria-label="Accesos rápidos" role="group">
          {QUICK_ACTIONS[mode].map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={pending}
              onClick={() => send(action.prompt ?? action.label, action)}
            >
              {action.label}
            </Button>
          ))}
        </div>

        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <label htmlFor={`assistant-input-${petId}`} className="sr-only">
            Tu pregunta
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id={`assistant-input-${petId}`}
              ref={input}
              value={draft}
              rows={2}
              maxLength={MAX_CHARS}
              placeholder={
                mode === "clinic" ? "Preguntá sobre el paciente…" : "Escribí tu pregunta…"
              }
              aria-describedby={`assistant-count-${petId}`}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (isSendKey({ ...event, isComposing: event.nativeEvent.isComposing })) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              // 16px: iOS does not zoom into the field.
              className="max-h-40 min-h-11 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
            <Button
              type="submit"
              variant="solido"
              size="icon-lg"
              className="size-11"
              disabled={!canSend(draft, pending)}
              aria-label="Enviar"
            >
              <SendHorizontal aria-hidden />
            </Button>
          </div>
          <p
            id={`assistant-count-${petId}`}
            className={cn(
              "text-right text-[0.7rem] tabular-nums text-muted-foreground",
              left < 100 && "font-semibold text-foreground",
            )}
          >
            {draft.length.toLocaleString("es-CR")} / {MAX_CHARS.toLocaleString("es-CR")}
            <span className="sr-only">
              {" "}
              caracteres. Enter envía, Mayús+Enter salta de línea.
            </span>
          </p>
        </form>

        <p className="text-center text-[0.7rem] text-muted-foreground">{FOOTER[mode]}</p>
      </div>
    </div>
  );
}

function Bubble({ entry, mode }: { entry: ChatEntry; mode: AssistantMode }) {
  if (entry.role === "user")
    return (
      <div
        data-entry={entry.id}
        className="ml-auto max-w-[85%] rounded-lg bg-muted px-3.5 py-2.5 text-sm whitespace-pre-wrap"
      >
        <span className="sr-only">Vos: </span>
        {entry.display ?? entry.content}
      </div>
    );
  return (
    <div data-entry={entry.id} className="flex max-w-[92%] scroll-mt-3 flex-col gap-2">
      {entry.urgent && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border-2 border-destructive bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <Siren className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-display text-[0.8rem] font-bold tracking-[0.14em] uppercase">
              Posible emergencia
            </p>
            <p className="mt-0.5 font-medium">
              {mode === "owner"
                ? "Andá ya a una veterinaria de emergencias. No esperés a ver si mejora."
                : "La consulta menciona signos de emergencia."}
            </p>
          </div>
        </div>
      )}
      <div className="border-l-2 border-primary/60 pl-3.5 text-sm leading-relaxed">
        <span className="sr-only">Asistente: </span>
        <AssistantMarkdown text={entry.content} />
      </div>
      {entry.copyable && <CopyButton text={entry.content} />}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={() =>
        void navigator.clipboard.writeText(plainText(text)).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}
