import { formatDate, localDay } from "./format";
import type { Tone } from "./pet-summary";

/**
 * The owner's inbox, apart from the DOM: how each notice reads, its color,
 * which group it falls in and what a swipe means. Pure logic, tested on its
 * own.
 */

export interface InboxItem {
  id: string;
  petId: string;
  petName: string;
  kind: string;
  subject: string;
  dueOn: string;
  offsetDays: number;
  readAt: string | null;
  createdAt: string;
}

export type InboxKind = "vaccination" | "deworming" | "weight" | "other";

export const kindOf = (item: Pick<InboxItem, "kind">): InboxKind =>
  item.kind === "vaccination" || item.kind === "deworming" || item.kind === "weight"
    ? item.kind
    : "other";

/** The notice in words: a title and a line with its date. */
export function describeNotice(item: InboxItem): { title: string; detail: string } {
  if (kindOf(item) === "weight")
    return {
      title: `El peso de ${item.petName} ${item.subject}`,
      detail: `Cambio brusco en el registro del ${formatDate(item.dueOn)}`,
    };
  return {
    title: `${item.subject} de ${item.petName}`,
    detail: `${item.offsetDays === 0 ? "Corresponde hoy" : "Próxima fecha"}: ${formatDate(item.dueOn)}`,
  };
}

/**
 * Color of a notice: a dose due today in red, one coming up in amber, a
 * sudden weight change in amber.
 */
export function toneOfNotice(item: InboxItem): Tone {
  switch (kindOf(item)) {
    case "weight":
      return "warn";
    case "vaccination":
    case "deworming":
      return item.offsetDays === 0 ? "alert" : "warn";
    default:
      return "muted";
  }
}

/** Where the notice goes when tapped. */
export const noticeHref = (item: InboxItem): string =>
  `/mascotas/${item.petId}/${kindOf(item) === "weight" ? "peso" : "vacunas"}`;

export type InboxGroup = "Hoy" | "Esta semana" | "Antes";

const DAY_MS = 86_400_000;

/**
 * Today, the last seven days, or before, on the Costa Rican calendar. Groups
 * keep the newest-first order of the items and skip empty ones.
 */
export function groupNotices(
  items: readonly InboxItem[],
  now: Date = new Date(),
): { group: InboxGroup; items: InboxItem[] }[] {
  const today = Date.parse(`${localDay(now.toISOString())}T00:00:00Z`);
  const groups: Record<InboxGroup, InboxItem[]> = {
    Hoy: [],
    "Esta semana": [],
    Antes: [],
  };
  for (const item of items) {
    const day = Date.parse(`${localDay(item.createdAt)}T00:00:00Z`);
    const days = Math.round((today - day) / DAY_MS);
    groups[days <= 0 ? "Hoy" : days < 7 ? "Esta semana" : "Antes"].push(item);
  }
  return (["Hoy", "Esta semana", "Antes"] as const)
    .filter((group) => groups[group].length)
    .map((group) => ({ group, items: groups[group] }));
}

/** How far a row must travel, as a share of its width, to act. */
export const SWIPE_THRESHOLD = 0.35;

/**
 * What a horizontal swipe does once released: to the right marks the notice
 * read (if it is unread), to the left removes it. Short or vertical-ish
 * moves do nothing.
 */
export function swipeAction(
  dx: number,
  width: number,
  unread: boolean,
): "read" | "dismiss" | null {
  if (width <= 0) return null;
  const share = dx / width;
  if (share <= -SWIPE_THRESHOLD) return "dismiss";
  if (share >= SWIPE_THRESHOLD && unread) return "read";
  return null;
}
