import {
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_MESSAGES,
  type AssistantMessage,
  type AssistantMode,
  type AssistantUsage,
} from "@vetify/types";

/**
 * The assistant chat's logic, apart from the DOM: the history sent to the
 * API, the character limit, the month's usage in words, the quick actions
 * and a small, safe Markdown reader for the answers.
 */

/** One bubble of the conversation, as the chat keeps it in its state. */
export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  /** What was sent or answered: the history is built from this. */
  content: string;
  /** A quick action shows its short label; `content` is the full prompt. */
  display?: string;
  /** The answer flagged an emergency sign: show the banner above it. */
  urgent?: boolean;
  /** Offer "Copiar" (instructions for the owner). */
  copyable?: boolean;
}

export const MAX_CHARS = ASSISTANT_MAX_MESSAGE_CHARS;

/**
 * What goes to the API: the last ASSISTANT_MAX_MESSAGES bubbles, oldest
 * first. The API caps every message at 2,000 characters; the user's input
 * already is, but a long answer of the assistant is cut so a follow-up
 * question is never rejected. The server stores nothing, so this is the
 * whole memory of the conversation.
 */
export function buildHistory(entries: readonly ChatEntry[]): AssistantMessage[] {
  const recent = entries.slice(-ASSISTANT_MAX_MESSAGES);
  // A history that starts with an answer reads as context without its question;
  // the API accepts it, but dropping it keeps the model's view coherent.
  const start = recent.findIndex((e) => e.role === "user");
  return recent.slice(start === -1 ? recent.length : start).map((e) => ({
    role: e.role,
    content:
      e.content.length > MAX_CHARS ? `${e.content.slice(0, MAX_CHARS - 1)}…` : e.content,
  }));
}

/** Characters left in the input; negative when over. */
export const charsLeft = (text: string): number => MAX_CHARS - text.length;

/** Whether the input can be sent: something written, within the limit. */
export function canSend(text: string, pending: boolean): boolean {
  return !pending && text.trim().length > 0 && text.length <= MAX_CHARS;
}

/** "12 de 30 mensajes gratis este mes", or null when unlimited. */
export function usageLabel(usage: AssistantUsage | undefined): string | null {
  if (!usage || usage.limit === null) return null;
  const used = Math.min(usage.used, usage.limit);
  return `${used} de ${usage.limit} ${usage.limit === 1 ? "mensaje gratis" : "mensajes gratis"} este mes`;
}

/** Enter sends; Shift+Enter (or composing an accent) adds a line. */
export function isSendKey(event: {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
}): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}

export interface QuickAction {
  label: string;
  /** What is sent; the label when absent. */
  prompt?: string;
  /** The answer gets a "Copiar" button. */
  copyable?: boolean;
}

export const QUICK_ACTIONS: Record<AssistantMode, QuickAction[]> = {
  clinic: [
    {
      label: "Resumen pre-consulta",
      prompt:
        "Haceme un resumen pre-consulta de este paciente. Indicá quién firmó cada acto si consta.",
    },
    { label: "¿Qué vacunas tiene vencidas o por vencer?" },
    { label: "Tendencia de peso", prompt: "¿Cuál es la tendencia de peso del paciente?" },
    {
      label: "Redactar indicaciones para el dueño",
      prompt:
        "Redactá indicaciones para el dueño, en lenguaje sencillo y en pasos, listas para copiar.",
      copyable: true,
    },
  ],
  owner: [
    { label: "¿Le toca alguna vacuna?" },
    { label: "¿Su peso está bien?" },
    { label: "¿Qué puede comer y qué no?" },
  ],
};

export const FOOTER: Record<AssistantMode, string> = {
  owner: "Orientación general, no sustituye una consulta veterinaria.",
  clinic: "Apoyo para el veterinario; la decisión clínica es suya.",
};

// ---------- Safe Markdown ----------
//
// The model answers in plain Markdown: bold, bullet and numbered lists. This
// reads only that into data; the component renders it as React elements, so
// no HTML from the answer is ever interpreted.

export interface Inline {
  text: string;
  bold: boolean;
}

export type Block =
  | { kind: "paragraph"; lines: Inline[][] }
  | {
      kind: "list";
      ordered: boolean;
      /** Number of the first item, as written: "3." after a paragraph stays 3. */
      start: number;
      items: Inline[][];
    };

/** Splits `**bold**` (or `__bold__`) from plain text. Unpaired marks stay as text. */
export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last)
      parts.push({ text: text.slice(last, match.index), bold: false });
    parts.push({ text: match[1] ?? match[2] ?? "", bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** Paragraphs and lists; a heading reads as a bold line. */
export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] | null = null;
  let list: Extract<Block, { kind: "list" }> | null = null;

  const close = () => {
    paragraph = null;
    list = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      close();
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const content = bullet ? bullet[1]! : numbered![2]!;
      if (!list || list.ordered !== ordered) {
        // Models often split a numbered list with blank lines or bullets:
        // the written number keeps the count right.
        const start = numbered ? Number(numbered[1]) : 1;
        list = { kind: "list", ordered, start, items: [] };
        blocks.push(list);
        paragraph = null;
      }
      list.items.push(parseInline(content));
      continue;
    }
    const heading = HEADING.exec(line);
    const inline = heading
      ? [{ text: heading[1]!.replace(/\*\*|__/g, ""), bold: true }]
      : parseInline(line.trim());
    if (!paragraph) {
      paragraph = [];
      blocks.push({ kind: "paragraph", lines: paragraph });
      list = null;
    }
    paragraph.push(inline);
  }
  return blocks;
}

/** The answer as plain text, for "Copiar": no Markdown marks. */
export function plainText(text: string): string {
  return parseMarkdown(text)
    .map((block) =>
      block.kind === "paragraph"
        ? block.lines.map((line) => line.map((i) => i.text).join("")).join("\n")
        : block.items
            .map(
              (item, n) =>
                `${block.ordered ? `${block.start + n}.` : "-"} ${item.map((i) => i.text).join("")}`,
            )
            .join("\n"),
    )
    .join("\n\n");
}

// ---------- Which pet the panel opens with ----------

const PET_ON_SCREEN =
  /^\/(?:mascotas|pacientes)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

/** The pet whose screen this is (owner's pet or clinic's patient), if any. */
export function petOnScreen(path: string): string | null {
  return PET_ON_SCREEN.exec(path)?.[1] ?? null;
}

/**
 * The pet the assistant opens with: the one asked for (an entry on its
 * screen), else the one on screen, else the last one chosen, as long as it is
 * still among `ids`; with a single pet, that one. Null: the user chooses.
 */
export function choosePet(
  ids: readonly string[],
  from: { requested?: string | null; onScreen?: string | null; previous?: string | null },
): string | null {
  for (const candidate of [from.requested, from.onScreen, from.previous])
    if (candidate && ids.includes(candidate)) return candidate;
  return ids.length === 1 ? ids[0]! : null;
}
