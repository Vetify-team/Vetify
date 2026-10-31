import { describe, expect, it } from "vitest";
import { ownerTabHref } from "../src/lib/owner-navigation";

describe("owner navigation", () => {
  it("opens a selected pet's schedule and card directly", () => {
    expect(ownerTabHref("/esquema", "pet-id")).toBe("/mascotas/pet-id/vacunas");
    expect(ownerTabHref("/carne", "pet-id")).toBe("/mascotas/pet-id/carne");
  });
  it("keeps the normal destination when no pet is selected and other tabs unchanged", () => {
    expect(ownerTabHref("/carne")).toBe("/carne");
    expect(ownerTabHref("/esquema")).toBe("/esquema");
    expect(ownerTabHref("/avisos", "pet-id")).toBe("/avisos");
  });
});
