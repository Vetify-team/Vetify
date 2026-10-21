import type { Alert } from "@vetify/types";
import { dewormingLabel } from "./format";

/**
 * Exports alerts to an iCalendar (.ics) file for Google Calendar, Apple
 * Calendar or Outlook. Built in the browser: nothing leaves the device.
 */

/**
 * RFC 5545 text escaping. Backslash first, then separators; any line break or
 * control character is neutralized so a value cannot inject properties.
 */
export const escapeText = (text: string): string =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/[;,]/g, (c) => `\\${c}`)
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");

const icsDate = (date: string) => date.replaceAll("-", "");
const alertName = (a: Alert) =>
  a.kind === "deworming" ? dewormingLabel(a.name) : a.name;

export function alertsToIcs(alerts: Alert[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = alerts
    .filter((a): a is Alert & { dueOn: string } => !!a.dueOn)
    .map((a) => {
      const end = new Date(`${a.dueOn}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      return [
        "BEGIN:VEVENT",
        `UID:${a.petId}-${icsDate(a.dueOn)}-${encodeURIComponent(a.name)}@vetify`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(a.dueOn)}`,
        `DTEND;VALUE=DATE:${icsDate(end.toISOString().slice(0, 10))}`,
        `SUMMARY:${escapeText(`${alertName(a)} · ${a.petName}`)}`,
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(`Vetify: ${alertName(a)} de ${a.petName}`)}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vetify//Alerts//ES",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(alerts: Alert[], fileName: string): void {
  const url = URL.createObjectURL(
    new Blob([alertsToIcs(alerts)], { type: "text/calendar" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
