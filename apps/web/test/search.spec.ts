import type { Pet } from "@vetify/types";
import { describe, expect, it } from "vitest";
import { matchesPet } from "../src/lib/search";

const pet = (over: Partial<Pet> = {}): Pet => ({
  id: "p1",
  ownerId: "o1",
  name: "Ñandú",
  species: "dog",
  breed: "Labrador",
  sex: "male",
  birthDate: null,
  neutered: false,
  microchip: "985112003456789",
  photoUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("patient search", () => {
  it("matches name, breed, species and microchip, ignoring accents and case", () => {
    expect(matchesPet(pet(), "nandu")).toBe(true);
    expect(matchesPet(pet(), "LABRA")).toBe(true);
    expect(matchesPet(pet(), "perro")).toBe(true);
    expect(matchesPet(pet(), "3456789")).toBe(true);
  });

  it("needs every word and matches everything when empty", () => {
    expect(matchesPet(pet(), "nandu perro")).toBe(true);
    expect(matchesPet(pet(), "nandu gato")).toBe(false);
    expect(matchesPet(pet(), "   ")).toBe(true);
    expect(matchesPet(pet({ breed: null, microchip: null }), "labrador")).toBe(false);
  });
});
