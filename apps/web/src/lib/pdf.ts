import type { PdfDocument } from "./pdf-content";

/**
 * Draws a PdfDocument with jsPDF and downloads it. jsPDF is loaded only when
 * the user exports, so it stays out of the app's bundle. Helvetica covers
 * Spanish accents and ñ.
 */

const INK: [number, number, number] = [29, 27, 24];
const MUTED: [number, number, number] = [106, 100, 90];
const ACCENT: [number, number, number] = [138, 92, 20];
const RULE: [number, number, number] = [216, 207, 191];

const PAGE = { width: 210, height: 297, margin: 18 };
const BODY = 9.5;
const LINE = 4.6;

export async function downloadPdf(
  content: PdfDocument,
  fileName: string,
  qrDataUrl?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const width = PAGE.width - PAGE.margin * 2;
  let y = PAGE.margin;

  const ensure = (needed: number) => {
    if (y + needed > PAGE.height - PAGE.margin - 8) {
      doc.addPage();
      y = PAGE.margin;
    }
  };

  // Header: wordmark and rule.
  doc.setFont("times", "normal");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text("Vetify", PAGE.margin, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ACCENT);
  doc.text("EXPEDIENTE CLÍNICO COMPARTIDO", PAGE.width - PAGE.margin, y + 6, {
    align: "right",
  });
  y += 10;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  y += 9;

  // Title block, with the QR on the right when there is one.
  const qrSize = qrDataUrl ? 34 : 0;
  doc.setFont("times", "normal");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(content.title, width - qrSize - 4) as string[];
  doc.text(titleLines, PAGE.margin, y);
  if (qrDataUrl)
    doc.addImage(
      qrDataUrl,
      "PNG",
      PAGE.width - PAGE.margin - qrSize,
      y - 6,
      qrSize,
      qrSize,
    );
  y += titleLines.length * 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY);
  doc.setTextColor(...MUTED);
  doc.text(content.subtitle, PAGE.margin, y);
  y += 8;

  // Facts in two columns.
  const half = (width - qrSize) / 2;
  content.facts.forEach(([label, value], i) => {
    const x = PAGE.margin + (i % 2) * half;
    if (i % 2 === 0 && i > 0) y += 9;
    doc.setFontSize(7);
    doc.setTextColor(...ACCENT);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(BODY);
    doc.setTextColor(...INK);
    doc.text(value, x, y + 4.5);
  });
  y = Math.max(y + 14, qrDataUrl ? PAGE.margin + 19 + qrSize + 8 : 0);

  for (const table of content.tables) {
    ensure(20);
    doc.setFont("times", "normal");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(table.title, PAGE.margin, y);
    y += 2.5;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");

    if (table.rows.length === 0) {
      doc.setFontSize(BODY);
      doc.setTextColor(...MUTED);
      doc.text(table.empty, PAGE.margin, y);
      y += 9;
      continue;
    }

    // The last column takes the remaining width: it holds the longest text.
    const fixed = table.head.length > 2 ? 30 : 40;
    const columns = table.head.map((_, i) =>
      i < table.head.length - 1 ? fixed : width - fixed * (table.head.length - 1),
    );
    const xs = columns.map(
      (_, i) => PAGE.margin + columns.slice(0, i).reduce((a, b) => a + b, 0),
    );

    const drawHead = () => {
      doc.setFontSize(7);
      doc.setTextColor(...ACCENT);
      table.head.forEach((h, i) => doc.text(h.toUpperCase(), xs[i], y));
      y += 4;
    };
    drawHead();
    doc.setFontSize(BODY);
    for (const row of table.rows) {
      const cells = row.map(
        (cell, i) => doc.splitTextToSize(cell, columns[i] - 3) as string[],
      );
      const height = Math.max(...cells.map((c) => c.length)) * LINE + 2;
      if (y + height > PAGE.height - PAGE.margin - 8) {
        doc.addPage();
        y = PAGE.margin;
        drawHead();
        doc.setFontSize(BODY);
      }
      doc.setTextColor(...INK);
      cells.forEach((lines, i) => doc.text(lines, xs[i], y + 3));
      y += height;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.2);
      doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
      y += 1.5;
    }
    y += 6;
  }

  ensure(14);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(content.note, width) as string[], PAGE.margin, y);

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("www.vetify.live", PAGE.margin, PAGE.height - 10);
    doc.text(`Página ${page} de ${pages}`, PAGE.width - PAGE.margin, PAGE.height - 10, {
      align: "right",
    });
  }

  doc.save(fileName);
}
