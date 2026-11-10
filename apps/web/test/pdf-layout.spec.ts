import { jsPDF } from "jspdf";
import { afterAll, describe, expect, it } from "vitest";
import type { PdfDocument } from "../src/lib/pdf-content";
import { downloadPdf } from "../src/lib/pdf";

// Keep the document instead of downloading it. `save` is a plugin method on
// jsPDF.API, which the typings do not list.
const api = jsPDF.API as unknown as { save: (this: jsPDF) => jsPDF };
const originalSave = api.save;
const drawnDocs: jsPDF[] = [];
api.save = function (this: jsPDF) {
  drawnDocs.push(this);
  return this;
};
afterAll(() => {
  api.save = originalSave;
});

const NOTE =
  "Documento generado por el dueño desde Vetify. El expediente pertenece al dueño; cada clínica registró sus actos con su permiso.";

const record = (consultations: number): PdfDocument => ({
  title: "Expediente clínico · Luna",
  subtitle: "Emitido el 7 nov 2026",
  facts: [
    ["Especie", "Perro"],
    ["Raza", "—"],
    ["Sexo", "Hembra"],
    ["Nacimiento", "1 mar 2023"],
  ],
  tables: [
    {
      title: "Consultas",
      head: ["Fecha", "Clínica", "Motivo", "Diagnóstico"],
      rows: Array.from({ length: consultations }, (_, i) => [
        "5 ene 2026",
        "Clínica Central · Dra. Solís",
        `Control ${i}`,
        i % 3 ? "Sano" : "Otitis externa leve con limpieza y control en dos semanas",
      ]),
      empty: "Sin consultas.",
    },
    {
      title: "Vacunas",
      head: ["Aplicada", "Vacuna", "Lote", "Vence"],
      rows: [],
      empty: "Sin vacunas.",
    },
    {
      title: "Peso",
      head: ["Fecha", "Peso"],
      rows: [["1 ene 2026", "12 kg"]],
      empty: "Sin peso.",
    },
  ],
  note: NOTE,
});

/** Text drawn on each page, and the y (mm) of each line, from jsPDF's content stream. */
function pages(): { texts: string[]; ys: number[] }[] {
  const doc = drawnDocs.at(-1) as unknown as {
    internal: {
      pages: string[][];
      pageSize: { getHeight(): number };
      scaleFactor: number;
    };
  };
  const { pages, pageSize, scaleFactor } = doc.internal;
  return pages.slice(1).map((ops) => {
    const lines = ops.join("\n");
    return {
      texts: [...lines.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]),
      ys: [...lines.matchAll(/([\d.]+) ([\d.]+) Td/g)].map(
        (m) => pageSize.getHeight() - Number(m[2]) / scaleFactor,
      ),
    };
  });
}

describe("PDF layout", () => {
  it("never leaves the closing note alone on its own page", async () => {
    for (let n = 1; n <= 80; n++) {
      await downloadPdf(record(n), "x.pdf");
      const last = pages().at(-1)!;
      const content = last.texts.filter((t) => !/^www\.|^P\S*gina/.test(t));
      expect(
        content.some((t) => !NOTE.includes(t.slice(0, 20))),
        `${n} consultations: the last page has only the note`,
      ).toBe(true);
    }
  });

  it("keeps every line above the footer", async () => {
    for (const n of [22, 41, 60]) {
      await downloadPdf(record(n), "x.pdf");
      for (const page of pages()) {
        const footerY = Math.max(...page.ys);
        const body = page.ys.filter((y) => y < footerY - 0.01);
        expect(Math.max(...body)).toBeLessThan(footerY - 3);
      }
    }
  });
});
