import { describe, expect, it } from "vitest";
import { choosePet, petOnScreen } from "../src/lib/assistant";
import { avatarTone } from "../src/components/pets/pet-utils";

const ROCKY = "6d950fb3-434d-434e-9659-0c65568cdbde";
const MISHI = "973c6ce2-1f9b-439a-93c2-786431351621";

describe("petOnScreen", () => {
  it("reads the pet of an owner's screen or a clinic's patient", () => {
    expect(petOnScreen(`/mascotas/${ROCKY}`)).toBe(ROCKY);
    expect(petOnScreen(`/mascotas/${ROCKY}/vacunas`)).toBe(ROCKY);
    expect(petOnScreen(`/pacientes/${MISHI}`)).toBe(MISHI);
  });

  it("is null elsewhere", () => {
    expect(petOnScreen("/mascotas")).toBeNull();
    expect(petOnScreen("/mascotas/nueva")).toBeNull();
    expect(petOnScreen("/avisos")).toBeNull();
    expect(petOnScreen(`/otra/${ROCKY}`)).toBeNull();
  });
});

describe("choosePet", () => {
  const both = [ROCKY, MISHI];

  it("prefers the pet asked for, then the one on screen, then the last chosen", () => {
    expect(choosePet(both, { requested: MISHI, onScreen: ROCKY })).toBe(MISHI);
    expect(choosePet(both, { onScreen: ROCKY, previous: MISHI })).toBe(ROCKY);
    expect(choosePet(both, { previous: MISHI })).toBe(MISHI);
  });

  it("picks the only pet by itself", () => {
    expect(choosePet([ROCKY], {})).toBe(ROCKY);
    expect(choosePet([ROCKY], { previous: MISHI })).toBe(ROCKY);
  });

  it("lets the user choose among several, and never keeps a pet no longer listed", () => {
    expect(choosePet(both, {})).toBeNull();
    expect(choosePet([MISHI, "x"], { requested: ROCKY, onScreen: ROCKY })).toBeNull();
    expect(choosePet([], { requested: ROCKY })).toBeNull();
  });
});

describe("avatarTone", () => {
  it("gives the same tone to the same name, whatever its case or spaces", () => {
    expect(avatarTone("Rocky")).toBe(avatarTone(" rocky "));
    expect(avatarTone("Rocky")).toMatch(/^bg-\[#/);
  });

  it("spreads names over several tones", () => {
    const tones = new Set(
      ["Rocky", "Mishi", "Luna", "Canela", "Toby", "Nala", "Max", "Kira"].map(avatarTone),
    );
    expect(tones.size).toBeGreaterThan(2);
  });
});
