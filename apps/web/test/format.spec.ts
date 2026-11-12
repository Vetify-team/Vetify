import type { Alert } from "@vetify/types";
import { describe, expect, it } from "vitest";
import { summarizeAlerts } from "../src/components/pets/pet-utils";
import { formatDate, localDay } from "../src/lib/format";

describe("dates on the Costa Rican calendar", () => {
  it("keeps an act at 11:50 p.m. in Costa Rica on that day, not UTC's next one", () => {
    // 23:50 on 11 Nov in Costa Rica (UTC-6) is 05:50 on 12 Nov in UTC.
    expect(localDay("2026-11-12T05:50:00.000Z")).toBe("2026-11-11");
    expect(formatDate("2026-11-12T05:50:00.000Z")).toBe(formatDate("2026-11-11"));
  });

  it("leaves plain dates as they are", () => {
    expect(localDay("2026-11-12")).toBe("2026-11-12");
    expect(formatDate(null)).toBe("—");
  });
});

const alert = (status: Alert["status"]): Alert => ({
  petId: "p",
  petName: "Toby",
  kind: "vaccination",
  name: "Rabia",
  dueOn: "2027-11-11",
  status,
});

describe("summarizeAlerts", () => {
  it("does not call a pet with nothing recorded up to date", () => {
    expect(summarizeAlerts([])).toEqual({ text: "Sin registros", action: false });
  });

  it("summarizes recorded doses", () => {
    expect(summarizeAlerts([alert("valid")])).toEqual({ text: "Al día", action: false });
    expect(summarizeAlerts([alert("valid"), alert("expiring")]).text).toBe("Por vencer");
    expect(summarizeAlerts([alert("expired"), alert("expired")])).toEqual({
      text: "2 dosis vencidas",
      action: true,
    });
  });
});
