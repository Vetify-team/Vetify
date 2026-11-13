import type { Alert, VaccineStatus, WeightEntry } from "@vetify/types";
import { daysUntil, distance } from "./format";

/**
 * What a pet's card and panel say at a glance. Pure logic: the screens only
 * paint it.
 */

export type Tone = "ok" | "warn" | "alert" | "muted";

/** Color of a status; the word always goes with it. */
export const toneOf: Record<VaccineStatus, Tone> = {
  valid: "ok",
  expiring: "warn",
  expired: "alert",
  due: "alert",
  not_yet_due: "muted",
};

export const STATUS_WORD: Record<VaccineStatus, string> = {
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Vencida",
  due: "Pendiente",
  not_yet_due: "Aún no",
};

export interface DoseSummary {
  /** "Rabia", or "Al día" when every dose is in force. */
  title: string;
  /** "en 8 días", "venció hace 3 meses"… */
  detail: string;
  tone: Tone;
}

/**
 * The dose to look at first: an expired one, else the next to expire, else
 * "al día". Only recorded doses produce alerts, so none means nothing
 * recorded yet.
 */
export function nextDose(
  alerts: readonly Alert[],
  kind: Alert["kind"] = "vaccination",
): DoseSummary {
  const own = alerts.filter((a) => a.kind === kind && a.status !== "not_yet_due");
  if (!own.length)
    return {
      title: kind === "vaccination" ? "Sin vacunas" : "Sin registros",
      detail: "Todavía no hay dosis registradas",
      tone: "muted",
    };
  const expired = own.filter((a) => a.status === "expired" || a.status === "due");
  if (expired.length) {
    const first = expired[0]!;
    return {
      title: expired.length > 1 ? `${expired.length} vencidas` : first.name,
      detail:
        expired.length > 1
          ? expired.map((a) => a.name).join(", ")
          : first.dueOn
            ? `Venció hace ${distance(daysUntil(first.dueOn))}`
            : "Pendiente",
      tone: "alert",
    };
  }
  const upcoming = own
    .filter((a) => a.dueOn)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))[0];
  if (!upcoming) return { title: "Al día", detail: "Todo vigente", tone: "ok" };
  const days = daysUntil(upcoming.dueOn!);
  return {
    title: upcoming.status === "expiring" ? upcoming.name : "Al día",
    detail:
      upcoming.status === "expiring"
        ? days === 0
          ? "Vence hoy"
          : `Vence en ${distance(days)}`
        : `Próxima: ${upcoming.name} en ${distance(days)}`,
    tone: toneOf[upcoming.status],
  };
}

export interface WeightSummary {
  kg: number;
  recordedOn: string;
  /** Change since the previous entry, in kg; null with a single entry. */
  change: number | null;
}

/** The last weight and its change. `entries` come newest first, as the API sends them. */
export function latestWeight(entries: readonly WeightEntry[]): WeightSummary | null {
  const [last, previous] = entries;
  if (!last) return null;
  return {
    kg: last.weightKg,
    recordedOn: last.recordedOn,
    change: previous ? Math.round((last.weightKg - previous.weightKg) * 10) / 10 : null,
  };
}

const kgFormat = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 1 });

/** "32,6 kg". */
export const formatKg = (kg: number): string => `${kgFormat.format(kg)} kg`;

/** "+0,6 kg", "−0,4 kg" or "sin cambio". */
export function formatChange(change: number | null): string | null {
  if (change === null) return null;
  if (change === 0) return "sin cambio";
  return `${change > 0 ? "+" : "−"}${kgFormat.format(Math.abs(change))} kg`;
}

/**
 * The one status line of a pet's card: the most important thing about its
 * vaccines. An expired dose first, then one about to expire, else "al día".
 */
export function statusLine(alerts: readonly Alert[]): { text: string; tone: Tone } {
  const dose = nextDose(alerts);
  if (dose.tone === "muted") return { text: "Sin vacunas registradas", tone: "muted" };
  if (dose.tone === "alert")
    return {
      text: dose.title.endsWith("vencidas")
        ? `${dose.title}: ${dose.detail}`
        : `${dose.title} vencida`,
      tone: "alert",
    };
  if (dose.tone === "warn")
    return { text: `${dose.title}: ${dose.detail.toLowerCase()}`, tone: "warn" };
  return { text: "Vacunas al día", tone: "ok" };
}

const WEIGHT_ALERT_SHARE = 0.1;
const WEIGHT_ALERT_GAP_DAYS = 90;
const WEIGHT_ALERT_RECENT_DAYS = 30;
const DAY = 86_400_000;

/**
 * A sudden weight change worth a look, by the same rule as the owner's
 * weight alerts: 10 % or more between the last two entries, taken at most
 * 90 days apart. For the clinic's day, only when the last one is recent (30
 * days). `entries` come newest first; `today` is YYYY-MM-DD.
 */
export function suddenWeightChange(
  entries: readonly WeightEntry[],
  today: string,
): { percent: number; recordedOn: string } | null {
  const [last, previous] = entries;
  if (!last || !previous || previous.weightKg <= 0) return null;
  const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
  if ((at(last.recordedOn) - at(previous.recordedOn)) / DAY > WEIGHT_ALERT_GAP_DAYS)
    return null;
  if ((at(today) - at(last.recordedOn)) / DAY > WEIGHT_ALERT_RECENT_DAYS) return null;
  const share = (last.weightKg - previous.weightKg) / previous.weightKg;
  if (Math.abs(share) < WEIGHT_ALERT_SHARE) return null;
  return { percent: Math.round(share * 100), recordedOn: last.recordedOn };
}
