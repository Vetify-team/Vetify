import type { MedicalRecord } from "@vetify/types";
import { describe, expect, it } from "vitest";
import { mergeRecordPage } from "../src/lib/record-pages";

const record = (changes: Partial<MedicalRecord> = {}): MedicalRecord => ({
  nextCursors: {},
  clinics: [],
  veterinarians: [],
  consultations: [],
  vaccinations: [],
  dewormings: [],
  treatments: [],
  exams: [],
  weightEntries: [],
  feedingEntries: [],
  ...changes,
});
const weight = (id: string) => ({
  id,
  petId: "pet",
  weightKg: 10,
  recordedOn: "2026-01-01",
});

describe("mergeRecordPage", () => {
  it("appends the page, replaces the section cursor and dedupes ids", () => {
    const current = record({
      nextCursors: { weightEntries: "b", exams: "x" },
      weightEntries: [weight("a"), weight("b")],
      clinics: [{ id: "c1", name: "Clínica" }],
    });
    const page = record({
      nextCursors: { weightEntries: "d" },
      weightEntries: [weight("b"), weight("c"), weight("d")],
      clinics: [
        { id: "c1", name: "Clínica" },
        { id: "c2", name: "Otra" },
      ],
    });
    const merged = mergeRecordPage(current, page, "weightEntries", "b");
    expect(merged?.weightEntries.map((w) => w.id)).toEqual(["a", "b", "c", "d"]);
    expect(merged?.nextCursors).toEqual({ exams: "x", weightEntries: "d" });
    expect(merged?.clinics.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("drops the last page's cursor when the section is exhausted", () => {
    const current = record({
      nextCursors: { weightEntries: "a" },
      weightEntries: [weight("a")],
    });
    const merged = mergeRecordPage(
      current,
      record({ weightEntries: [weight("b")] }),
      "weightEntries",
      "a",
    );
    expect(merged?.nextCursors).toEqual({});
  });

  it("ignores a page whose cursor is stale", () => {
    const current = record({
      nextCursors: { weightEntries: "new" },
      weightEntries: [weight("new")],
    });
    const page = record({ weightEntries: [weight("old")] });
    expect(mergeRecordPage(current, page, "weightEntries", "old")).toBe(current);
    expect(mergeRecordPage(undefined, page, "weightEntries", "old")).toBeUndefined();
  });
});
