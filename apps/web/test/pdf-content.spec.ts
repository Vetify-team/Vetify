import type { MedicalRecord, Pet, VaccinationStatus } from "@vetify/types";
import { describe, expect, it } from "vitest";
import { cardDocument, pdfFileName, recordDocument } from "../src/lib/pdf-content";

const id = "00000000-0000-4000-8000-000000000001";
const pet: Pet = {
  id,
  ownerId: id,
  name: "Luna",
  species: "dog",
  breed: null,
  sex: "female",
  birthDate: "2023-03-01",
  neutered: true,
  microchip: "985000000000001",
  photoUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
} as Pet;

const empty: MedicalRecord = {
  nextCursors: {},
  clinics: [{ id, name: "Clínica Central" }],
  veterinarians: [{ id, name: "Dra. Solís" }],
  consultations: [],
  vaccinations: [],
  dewormings: [],
  treatments: [],
  exams: [],
  weightEntries: [],
  feedingEntries: [],
};

describe("PDF content", () => {
  it("lists the pet's facts and the card's vaccines", () => {
    const status = {
      country: "CR",
      species: "dog",
      coverage: 50,
      vaccines: [
        {
          vaccine: "Rabia",
          status: "valid",
          lastAppliedOn: "2026-03-12",
          expiresOn: "2027-03-12",
          nextDueOn: null,
        },
        {
          vaccine: "Parvovirus",
          status: "due",
          lastAppliedOn: null,
          expiresOn: null,
          nextDueOn: null,
        },
      ],
      dewormings: [],
    } as VaccinationStatus;
    const doc = cardDocument(pet, status, "2026-11-07");
    expect(doc.title).toBe("Carné de vacunación · Luna");
    expect(doc.facts).toContainEqual(["Especie", "Perro"]);
    expect(doc.facts).toContainEqual(["Esterilizado", "Sí"]);
    // Only applied vaccines are on the card.
    expect(doc.tables[0].rows).toHaveLength(1);
    expect(doc.tables[0].rows[0].slice(0, 2)).toEqual(["Rabia", "Vigente"]);
    expect(doc.tables[1].rows).toHaveLength(0);
  });

  it("orders record entries newest first and names the clinic and vet", () => {
    const record: MedicalRecord = {
      ...empty,
      consultations: [
        {
          id,
          petId: id,
          clinicId: id,
          veterinarianId: id,
          date: "2026-01-05T10:00:00.000Z",
          reason: "Control",
          diagnosis: null,
          notes: null,
        },
        {
          id,
          petId: id,
          clinicId: null,
          veterinarianId: null,
          date: "2026-06-05T10:00:00.000Z",
          reason: "Vómito",
          diagnosis: "Gastritis",
          notes: null,
        },
      ],
      weightEntries: [{ id, petId: id, recordedOn: "2026-02-01", weightKg: 12.5 }],
    } as MedicalRecord;
    const doc = recordDocument(pet, record, "2026-11-07");
    const consultations = doc.tables.find((t) => t.title === "Consultas")!;
    expect(consultations.rows.map((r) => r[2])).toEqual(["Vómito", "Control"]);
    expect(consultations.rows[1][1]).toBe("Clínica Central · Dra. Solís");
    expect(consultations.rows[0][1]).toBe("—");
    expect(doc.tables.find((t) => t.title === "Peso")!.rows[0][1]).toBe("12,5 kg");
  });

  it("builds safe file names", () => {
    expect(pdfFileName("Expediente", "Ñoño Pérez!", "2026-11-07")).toBe(
      "Expediente-Nono-Perez-2026-11-07.pdf",
    );
    expect(pdfFileName("Carne", "***", "2026-11-07")).toBe(
      "Carne-mascota-2026-11-07.pdf",
    );
  });
});
