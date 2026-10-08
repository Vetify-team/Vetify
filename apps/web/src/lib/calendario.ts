import type { Aviso } from "@vetify/types";

/**
 * Exporta avisos a un archivo iCalendar (.ics) que abre Google Calendar,
 * Apple Calendar u Outlook. Se arma en el navegador: no sale nada del equipo.
 */

const escapar = (texto: string) =>
  texto.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const fechaIcs = (fecha: string) => fecha.replaceAll("-", "");

export function avisosAIcs(avisos: Aviso[]): string {
  const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const eventos = avisos
    .filter((a): a is Aviso & { fecha: string } => !!a.fecha)
    .map((a) => {
      const fin = new Date(`${a.fecha}T00:00:00Z`);
      fin.setUTCDate(fin.getUTCDate() + 1);
      return [
        "BEGIN:VEVENT",
        `UID:${a.mascotaId}-${fechaIcs(a.fecha)}-${encodeURIComponent(a.nombre)}@vetify`,
        `DTSTAMP:${ahora}`,
        `DTSTART;VALUE=DATE:${fechaIcs(a.fecha)}`,
        `DTEND;VALUE=DATE:${fechaIcs(fin.toISOString().slice(0, 10))}`,
        `SUMMARY:${escapar(`${a.nombre} · ${a.mascotaNombre}`)}`,
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapar(`Vetify: ${a.nombre} de ${a.mascotaNombre}`)}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vetify//Avisos//ES",
    ...eventos,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function descargarIcs(avisos: Aviso[], nombreArchivo: string): void {
  const url = URL.createObjectURL(
    new Blob([avisosAIcs(avisos)], { type: "text/calendar" }),
  );
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
