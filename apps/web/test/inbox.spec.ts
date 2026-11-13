import { describe, expect, it } from "vitest";
import {
  describeNotice,
  groupNotices,
  kindOf,
  noticeHref,
  swipeAction,
  toneOfNotice,
  type InboxItem,
} from "../src/lib/inbox";

const item = (over: Partial<InboxItem> = {}): InboxItem => ({
  id: over.id ?? "n1",
  petId: "p1",
  petName: "Rocky",
  kind: "vaccination",
  subject: "Rabia",
  dueOn: "2026-11-20",
  offsetDays: 7,
  readAt: null,
  createdAt: "2026-11-13T15:00:00.000Z",
  ...over,
});

describe("inbox", () => {
  it("reads each kind of notice in words and links to its screen", () => {
    expect(describeNotice(item())).toEqual({
      title: "Rabia de Rocky",
      detail: "Próxima fecha: 20 nov 2026",
    });
    expect(describeNotice(item({ offsetDays: 0 })).detail).toBe(
      "Corresponde hoy: 20 nov 2026",
    );
    expect(describeNotice(item({ kind: "weight", subject: "bajó 12 %" })).title).toBe(
      "El peso de Rocky bajó 12 %",
    );
    expect(noticeHref(item())).toBe("/mascotas/p1/vacunas");
    expect(noticeHref(item({ kind: "weight" }))).toBe("/mascotas/p1/peso");
    expect(kindOf(item({ kind: "algo-nuevo" }))).toBe("other");
  });

  it("colors a dose due today red and the rest amber", () => {
    expect(toneOfNotice(item({ offsetDays: 0 }))).toBe("alert");
    expect(toneOfNotice(item())).toBe("warn");
    expect(toneOfNotice(item({ kind: "deworming", offsetDays: 0 }))).toBe("alert");
    expect(toneOfNotice(item({ kind: "weight" }))).toBe("warn");
    expect(toneOfNotice(item({ kind: "algo-nuevo" }))).toBe("muted");
  });

  it("groups by today, this week and before, on the Costa Rican calendar", () => {
    // 13 Nov 2026, 10 a.m. in Costa Rica.
    const now = new Date("2026-11-13T16:00:00.000Z");
    const groups = groupNotices(
      [
        item({ id: "today", createdAt: "2026-11-13T07:00:00.000Z" }),
        // 12 Nov at 11 p.m. in Costa Rica is already the 13th in UTC: yesterday here.
        item({ id: "yesterday", createdAt: "2026-11-13T05:00:00.000Z" }),
        item({ id: "six", createdAt: "2026-11-07T15:00:00.000Z" }),
        item({ id: "old", createdAt: "2026-11-06T15:00:00.000Z" }),
      ],
      now,
    );
    expect(groups.map((g) => [g.group, g.items.map((i) => i.id)])).toEqual([
      ["Hoy", ["today"]],
      ["Esta semana", ["yesterday", "six"]],
      ["Antes", ["old"]],
    ]);
    expect(groupNotices([], now)).toEqual([]);
  });

  it("acts on a long swipe: right marks read, left removes", () => {
    expect(swipeAction(150, 390, true)).toBe("read");
    expect(swipeAction(150, 390, false)).toBeNull();
    expect(swipeAction(-150, 390, false)).toBe("dismiss");
    expect(swipeAction(-60, 390, true)).toBeNull();
    expect(swipeAction(60, 390, true)).toBeNull();
    expect(swipeAction(-200, 0, true)).toBeNull();
  });
});
