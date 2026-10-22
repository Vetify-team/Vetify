import { describe, expect, it } from "vitest";
import {
  EMPTY_WIZARD,
  firstName,
  nextStep,
  previousStep,
  progressOf,
  stepsFor,
} from "../src/lib/onboarding";

describe("onboarding steps", () => {
  it("orders the owner's and the clinic's steps", () => {
    expect(stepsFor("owner")).toEqual([
      "welcome",
      "role",
      "name",
      "access",
      "species",
      "petName",
      "petDetails",
      "creating",
      "plans",
    ]);
    expect(stepsFor("clinic")).toEqual([
      "welcome",
      "role",
      "name",
      "access",
      "clinicReview",
      "plans",
    ]);
    expect(nextStep("clinic", "access")).toBe("clinicReview");
    expect(nextStep("owner", "plans")).toBeNull();
  });

  it("fills the progress bar section by section", () => {
    expect(progressOf("owner", "welcome")).toEqual({ section: null, fills: [0, 0, 0] });
    expect(progressOf("owner", "name").fills).toEqual([2 / 3, 0, 0]);
    expect(progressOf("owner", "petName")).toEqual({ section: 1, fills: [1, 0.5, 0] });
    expect(progressOf("clinic", "clinicReview").fills).toEqual([1, 1, 0]);
    expect(progressOf("clinic", "plans").fills).toEqual([1, 1, 1]);
  });

  it("never goes back past a write", () => {
    const data = EMPTY_WIZARD;
    expect(previousStep("owner", "access", data)).toBe("name");
    expect(previousStep("owner", "species", data)).toBeNull();
    expect(previousStep("owner", "creating", data)).toBeNull();
    expect(previousStep("clinic", "clinicReview", data)).toBeNull();
    expect(previousStep("owner", "plans", data)).toBe("species");
    expect(previousStep("owner", "plans", { ...data, petId: "p1" })).toBeNull();
    expect(previousStep("clinic", "plans", data)).toBe("clinicReview");
  });

  it("greets by first name", () => {
    expect(firstName("  Ana  María Mora ")).toBe("Ana");
    expect(firstName("")).toBe("");
    expect(firstName("Dra. Laura Vega")).toBe("Dra. Laura");
    expect(firstName("Dr Pérez")).toBe("Dr Pérez");
  });
});
