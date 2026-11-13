import type { Alert } from "@vetify/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatChange,
  formatKg,
  latestWeight,
  nextDose,
  statusLine,
  suddenWeightChange,
  STATUS_WORD,
  toneOf,
} from "../src/lib/pet-summary";

const PET = "6d950fb3-434d-434e-9659-0c65568cdbde";
const alert = (
  name: string,
  status: Alert["status"],
  dueOn: string | null,
  kind: Alert["kind"] = "vaccination",
): Alert => ({ petId: PET, petName: "Rocky", kind, name, status, dueOn });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T15:00:00"));
});
afterEach(() => vi.useRealTimers());

describe("nextDose", () => {
  it("says nothing is recorded when there are no alerts", () => {
    expect(nextDose([])).toMatchObject({ title: "Sin vacunas", tone: "muted" });
    expect(nextDose([], "deworming")).toMatchObject({ title: "Sin registros" });
  });

  it("puts an expired dose first, in red", () => {
    expect(
      nextDose([
        alert("Rabia", "expiring", "2026-11-20"),
        alert("Moquillo", "expired", "2026-03-15"),
      ]),
    ).toEqual({ title: "Moquillo", detail: "Venció hace 8 meses", tone: "alert" });
    expect(
      nextDose([alert("Moquillo", "expired", "2026-03-15"), alert("Lepto", "due", null)]),
    ).toMatchObject({ title: "2 vencidas", detail: "Moquillo, Lepto", tone: "alert" });
  });

  it("names the dose about to expire, in amber", () => {
    expect(
      nextDose([
        alert("Polivalente", "valid", "2027-11-12"),
        alert("Rabia", "expiring", "2026-11-20"),
      ]),
    ).toEqual({ title: "Rabia", detail: "Vence en 8 días", tone: "warn" });
    expect(nextDose([alert("Rabia", "expiring", "2026-11-12")]).detail).toBe("Vence hoy");
  });

  it("is up to date, in green, when every dose is in force", () => {
    expect(nextDose([alert("Polivalente", "valid", "2027-11-12")])).toEqual({
      title: "Al día",
      detail: "Próxima: Polivalente en un año",
      tone: "ok",
    });
  });

  it("looks only at the kind asked for and ignores doses not yet due", () => {
    const alerts = [
      alert("internal", "expiring", "2026-11-20", "deworming"),
      alert("Rabia", "not_yet_due", "2027-01-01"),
    ];
    expect(nextDose(alerts)).toMatchObject({ title: "Sin vacunas" });
    expect(nextDose(alerts, "deworming")).toMatchObject({ tone: "warn" });
  });
});

describe("latestWeight", () => {
  const entry = (recordedOn: string, weightKg: number) => ({
    id: recordedOn,
    petId: PET,
    recordedOn,
    weightKg,
  });

  it("takes the newest weight and its change from the previous one", () => {
    expect(latestWeight([entry("2026-11-05", 32.6), entry("2026-08-12", 32)])).toEqual({
      kg: 32.6,
      recordedOn: "2026-11-05",
      change: 0.6,
    });
    expect(latestWeight([entry("2026-11-05", 4.1)])?.change).toBeNull();
    expect(latestWeight([])).toBeNull();
  });

  it("formats kilograms and the change in Costa Rican Spanish", () => {
    expect(formatKg(32.6)).toBe("32,6 kg");
    expect(formatChange(0.6)).toBe("+0,6 kg");
    expect(formatChange(-0.4)).toBe("−0,4 kg");
    expect(formatChange(0)).toBe("sin cambio");
    expect(formatChange(null)).toBeNull();
  });
});

describe("status colors", () => {
  it("pairs every status with a color and a word", () => {
    expect(toneOf).toEqual({
      valid: "ok",
      expiring: "warn",
      expired: "alert",
      due: "alert",
      not_yet_due: "muted",
    });
    expect(Object.keys(STATUS_WORD).sort()).toEqual(Object.keys(toneOf).sort());
  });
});

describe("statusLine", () => {
  it("says the most important thing: expired, then about to expire, then up to date", () => {
    expect(
      statusLine([
        alert("Rabia", "expiring", "2026-11-20"),
        alert("Moquillo", "expired", "2026-03-15"),
      ]),
    ).toEqual({ text: "Moquillo vencida", tone: "alert" });
    expect(
      statusLine([
        alert("Moquillo", "expired", "2026-03-15"),
        alert("Lepto", "due", null),
      ]),
    ).toEqual({ text: "2 vencidas: Moquillo, Lepto", tone: "alert" });
    expect(statusLine([alert("Rabia", "expiring", "2026-11-20")])).toEqual({
      text: "Rabia: vence en 8 días",
      tone: "warn",
    });
    expect(statusLine([alert("Polivalente", "valid", "2027-11-12")])).toEqual({
      text: "Vacunas al día",
      tone: "ok",
    });
    expect(statusLine([])).toEqual({ text: "Sin vacunas registradas", tone: "muted" });
  });
});

describe("suddenWeightChange", () => {
  const w = (recordedOn: string, weightKg: number) => ({
    id: recordedOn,
    petId: PET,
    recordedOn,
    weightKg,
  });

  it("flags a change of 10 % or more between the last two, recent entries", () => {
    expect(
      suddenWeightChange([w("2026-11-10", 11), w("2026-10-01", 10)], "2026-11-13"),
    ).toEqual({
      percent: 10,
      recordedOn: "2026-11-10",
    });
    expect(
      suddenWeightChange([w("2026-11-10", 8.8), w("2026-10-01", 10)], "2026-11-13")
        ?.percent,
    ).toBe(-12);
  });

  it("ignores small changes, far-apart entries, old ones and a single entry", () => {
    expect(
      suddenWeightChange([w("2026-11-10", 10.5), w("2026-10-01", 10)], "2026-11-13"),
    ).toBeNull();
    expect(
      suddenWeightChange([w("2026-11-10", 12), w("2026-07-01", 10)], "2026-11-13"),
    ).toBeNull();
    expect(
      suddenWeightChange([w("2026-09-01", 12), w("2026-08-01", 10)], "2026-11-13"),
    ).toBeNull();
    expect(suddenWeightChange([w("2026-11-10", 12)], "2026-11-13")).toBeNull();
  });
});
