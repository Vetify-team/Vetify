import type { VaccinationStatus } from "@vetify/types";
import { describe, expect, it } from "vitest";
import { recordedVaccines } from "../src/lib/vaccination";

const status = (vaccines: VaccinationStatus["vaccines"]): VaccinationStatus => ({
  country: "CR",
  species: "dog",
  coverage: 0,
  vaccines,
  dewormings: [],
});

describe("recordedVaccines", () => {
  it("shows nothing for a new pet, whose schedule has no doses yet", () => {
    const fresh = status([
      {
        vaccine: "Rabia",
        status: "due",
        lastAppliedOn: null,
        expiresOn: null,
        nextDueOn: null,
      },
      {
        vaccine: "Polivalente",
        status: "not_yet_due",
        lastAppliedOn: null,
        expiresOn: null,
        nextDueOn: "2027-01-01",
      },
    ]);
    expect(recordedVaccines(fresh)).toEqual([]);
  });

  it("keeps only the vaccines with a recorded dose", () => {
    const applied = {
      vaccine: "Rabia",
      status: "valid",
      lastAppliedOn: "2026-03-01",
      expiresOn: "2027-03-01",
      nextDueOn: "2027-03-01",
    } as const;
    const mixed = status([
      applied,
      {
        vaccine: "Polivalente",
        status: "due",
        lastAppliedOn: null,
        expiresOn: null,
        nextDueOn: null,
      },
    ]);
    expect(recordedVaccines(mixed)).toEqual([applied]);
  });
});
