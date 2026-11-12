import { ASSISTANT_MAX_MESSAGES, assistantRequestSchema } from "@vetify/types";
import { describe, expect, it } from "vitest";
import {
  buildHistory,
  canSend,
  charsLeft,
  FOOTER,
  isSendKey,
  MAX_CHARS,
  parseInline,
  parseMarkdown,
  plainText,
  QUICK_ACTIONS,
  usageLabel,
  type ChatEntry,
} from "../src/lib/assistant";
import { ApiRequestError } from "../src/lib/api-client";
import { assistantError, assistantLimitMessage, errorMessage } from "../src/lib/errors";

const user = (content: string, id = content): ChatEntry => ({
  id,
  role: "user",
  content,
});
const reply = (content: string, id = content): ChatEntry => ({
  id,
  role: "assistant",
  content,
});

describe("buildHistory", () => {
  it("sends the conversation oldest first, the question last", () => {
    expect(
      buildHistory([user("¿Vacunas?"), reply("Rabia al día."), user("¿Y el peso?")]),
    ).toEqual([
      { role: "user", content: "¿Vacunas?" },
      { role: "assistant", content: "Rabia al día." },
      { role: "user", content: "¿Y el peso?" },
    ]);
  });

  it("sends the full prompt of a quick action, not its label", () => {
    expect(
      buildHistory([
        { ...user("Haceme un resumen pre-consulta."), display: "Resumen pre-consulta" },
      ]),
    ).toEqual([{ role: "user", content: "Haceme un resumen pre-consulta." }]);
  });

  it("keeps only the last messages the API accepts, starting with a question", () => {
    const long = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? user(`q${i}`) : reply(`a${i}`),
    );
    const history = buildHistory([...long, user("última")]);
    expect(history.length).toBeLessThanOrEqual(ASSISTANT_MAX_MESSAGES);
    expect(history[0]!.role).toBe("user");
    expect(history.at(-1)).toEqual({ role: "user", content: "última" });
    expect(assistantRequestSchema.safeParse({ messages: history }).success).toBe(true);
  });

  it("cuts an answer over 2,000 characters so the next question is accepted", () => {
    const history = buildHistory([user("Resumen"), reply("x".repeat(3000)), user("¿Y?")]);
    expect(history[1]!.content).toHaveLength(MAX_CHARS);
    expect(history[1]!.content.endsWith("…")).toBe(true);
    expect(assistantRequestSchema.safeParse({ messages: history }).success).toBe(true);
  });

  it("is empty without a question", () => {
    expect(buildHistory([])).toEqual([]);
    expect(buildHistory([reply("Hola")])).toEqual([]);
  });
});

describe("character limit", () => {
  it("counts down from 2,000", () => {
    expect(MAX_CHARS).toBe(2000);
    expect(charsLeft("")).toBe(2000);
    expect(charsLeft("a".repeat(1990))).toBe(10);
    expect(charsLeft("a".repeat(2001))).toBe(-1);
  });

  it("sends only something written, within the limit, and not while waiting", () => {
    expect(canSend("Hola", false)).toBe(true);
    expect(canSend("a".repeat(2000), false)).toBe(true);
    expect(canSend("a".repeat(2001), false)).toBe(false);
    expect(canSend("   \n ", false)).toBe(false);
    expect(canSend("Hola", true)).toBe(false);
  });

  it("sends with Enter and adds a line with Shift+Enter or while composing", () => {
    expect(isSendKey({ key: "Enter", shiftKey: false })).toBe(true);
    expect(isSendKey({ key: "Enter", shiftKey: true })).toBe(false);
    expect(isSendKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
    expect(isSendKey({ key: "a", shiftKey: false })).toBe(false);
  });
});

describe("usageLabel", () => {
  it("shows the month's free messages only when there is a limit", () => {
    expect(usageLabel({ used: 12, limit: 30 })).toBe("12 de 30 mensajes gratis este mes");
    expect(usageLabel({ used: 31, limit: 30 })).toBe("30 de 30 mensajes gratis este mes");
    expect(usageLabel({ used: 0, limit: 1 })).toBe("0 de 1 mensaje gratis este mes");
    expect(usageLabel({ used: 400, limit: null })).toBeNull();
    expect(usageLabel(undefined)).toBeNull();
  });
});

describe("assistant errors", () => {
  const apiError = (status: number, code: string, reason?: string) =>
    new ApiRequestError(
      status,
      code as ConstructorParameters<typeof ApiRequestError>[1],
      "",
      undefined,
      reason as ConstructorParameters<typeof ApiRequestError>[4],
    );

  it("names the free messages used up and offers Premium", () => {
    expect(assistantError(apiError(429, "RATE_LIMITED", "ASSISTANT_LIMIT"), 30)).toEqual({
      message: "Usaste tus 30 mensajes gratis de este mes.",
      upgrade: true,
      retry: false,
    });
    expect(
      assistantError(apiError(429, "RATE_LIMITED", "ASSISTANT_LIMIT"), null).message,
    ).toBe("Usaste tus mensajes gratis de este mes.");
    expect(assistantLimitMessage(1)).toBe("Usaste tus 1 mensaje gratis de este mes.");
  });

  it("asks to try again in a few minutes when the provider is unavailable", () => {
    const unavailable = assistantError(
      apiError(503, "ASSISTANT_UNAVAILABLE", "ASSISTANT_UNAVAILABLE"),
      null,
    );
    expect(unavailable).toEqual({
      message:
        "El asistente no está disponible en este momento. Probá de nuevo en unos minutos.",
      upgrade: false,
      retry: true,
    });
    // The same words anywhere else the code shows up.
    expect(errorMessage(apiError(503, "ASSISTANT_UNAVAILABLE"))).toBe(
      unavailable.message,
    );
  });

  it("tells apart an assistant that is off, a burst, the network and the rest", () => {
    expect(
      assistantError(apiError(503, "ASSISTANT_UNAVAILABLE", "ASSISTANT_DISABLED"), null),
    ).toMatchObject({ upgrade: false, retry: false });
    expect(assistantError(apiError(429, "RATE_LIMITED"), 30)).toMatchObject({
      upgrade: false,
      retry: true,
    });
    expect(assistantError(apiError(0, "NETWORK_ERROR"), null)).toMatchObject({
      retry: true,
    });
    expect(assistantError(apiError(403, "CLINIC_SUSPENDED"), null)).toEqual({
      message: "La clínica está suspendida. Escribinos a Vetify para más información.",
      upgrade: false,
      retry: false,
    });
    expect(assistantError(new Error("boom"), null).retry).toBe(false);
  });
});

describe("safe Markdown", () => {
  it("reads bold and leaves unpaired marks as text", () => {
    expect(parseInline("La **rabia** vence pronto")).toEqual([
      { text: "La ", bold: false },
      { text: "rabia", bold: true },
      { text: " vence pronto", bold: false },
    ]);
    expect(parseInline("2 * 3 = 6")).toEqual([{ text: "2 * 3 = 6", bold: false }]);
  });

  it("reads paragraphs, bullet and numbered lists", () => {
    expect(
      parseMarkdown(
        "Hola.\nSegunda línea.\n\n- **Rabia:** vigente\n- Polivalente\n\n1. Uno\n2) Dos",
      ),
    ).toEqual([
      {
        kind: "paragraph",
        lines: [
          [{ text: "Hola.", bold: false }],
          [{ text: "Segunda línea.", bold: false }],
        ],
      },
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: [
          [
            { text: "Rabia:", bold: true },
            { text: " vigente", bold: false },
          ],
          [{ text: "Polivalente", bold: false }],
        ],
      },
      {
        kind: "list",
        ordered: true,
        start: 1,
        items: [[{ text: "Uno", bold: false }], [{ text: "Dos", bold: false }]],
      },
    ]);
  });

  it("keeps the written numbers when a numbered list is split by blank lines or bullets", () => {
    const blocks = parseMarkdown("1. Rabia\n\n2. Peso:\n- Medí la comida\n\n3. Alarma");
    expect(
      blocks.map((b) =>
        b.kind === "list" ? [b.ordered, b.start, b.items.length] : b.kind,
      ),
    ).toEqual([
      [true, 1, 1],
      [true, 2, 1],
      [false, 1, 1],
      [true, 3, 1],
    ]);
    expect(plainText("1. Rabia\n\n2. Peso")).toBe("1. Rabia\n\n2. Peso");
  });

  it("keeps HTML as plain text, never as markup", () => {
    const blocks = parseMarkdown('<img src=x onerror="alert(1)"> **hola**');
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        lines: [
          [
            { text: '<img src=x onerror="alert(1)"> ', bold: false },
            { text: "hola", bold: true },
          ],
        ],
      },
    ]);
  });

  it("reads a heading as a bold line", () => {
    expect(parseMarkdown("## **Resumen**")).toEqual([
      { kind: "paragraph", lines: [[{ text: "Resumen", bold: true }]] },
    ]);
  });

  it("copies an answer as plain text", () => {
    expect(plainText("**Indicaciones**\n\n1. Dale agua\n2. **No** le des pollo")).toBe(
      "Indicaciones\n\n1. Dale agua\n2. No le des pollo",
    );
  });
});

describe("quick actions and footers", () => {
  it("offers the clinic and owner shortcuts, copy only on the owner's instructions", () => {
    expect(QUICK_ACTIONS.clinic.map((a) => a.label)).toEqual([
      "Resumen pre-consulta",
      "¿Qué vacunas tiene vencidas o por vencer?",
      "Tendencia de peso",
      "Redactar indicaciones para el dueño",
    ]);
    expect(QUICK_ACTIONS.clinic.filter((a) => a.copyable).map((a) => a.label)).toEqual([
      "Redactar indicaciones para el dueño",
    ]);
    expect(QUICK_ACTIONS.owner.map((a) => a.label)).toEqual([
      "¿Le toca alguna vacuna?",
      "¿Su peso está bien?",
      "¿Qué puede comer y qué no?",
    ]);
    for (const action of [...QUICK_ACTIONS.clinic, ...QUICK_ACTIONS.owner])
      expect((action.prompt ?? action.label).length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it("shows the fixed footer of each mode", () => {
    expect(FOOTER.owner).toBe(
      "Orientación general, no sustituye una consulta veterinaria.",
    );
    expect(FOOTER.clinic).toBe("Apoyo para el veterinario; la decisión clínica es suya.");
  });
});
