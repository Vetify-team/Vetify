import type { AnimalSex, CreatePet, SignUpRole, Species } from "@vetify/types";
import type { PlanId } from "./plans";

/**
 * The sign-up wizard's steps and progress. Pure logic (no React, no `next/*`)
 * so the order and the progress bar are tested on their own.
 */

export type StepId =
  | "welcome"
  | "role"
  | "name"
  | "access"
  | "species"
  | "petName"
  | "petDetails"
  | "creating"
  | "clinicReview"
  | "plans";

/** What the wizard collects. The password is not here: it stays in its step. */
export interface WizardData {
  role: SignUpRole;
  name: string;
  email: string;
  clinicName: string;
  species: Species | null;
  petName: string;
  sex: AnimalSex | null;
  birthDate: string;
  neutered: boolean;
  petId: string | null;
  plan: PlanId;
}

export interface StepProps {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  next: () => void;
  goTo: (step: StepId) => void;
}

export const EMPTY_WIZARD: WizardData = {
  role: "owner",
  name: "",
  email: "",
  clinicName: "",
  species: null,
  petName: "",
  sex: null,
  birthDate: "",
  neutered: false,
  petId: null,
  plan: "free",
};

/** Steps grouped in the three sections of the progress bar. */
export function sectionsFor(role: SignUpRole): StepId[][] {
  return role === "owner"
    ? [
        ["role", "name", "access"],
        ["species", "petName", "petDetails", "creating"],
        ["plans"],
      ]
    : [["role", "name", "access"], ["clinicReview"], ["plans"]];
}

export function stepsFor(role: SignUpRole): StepId[] {
  return ["welcome", ...sectionsFor(role).flat()];
}

export function sectionLabels(role: SignUpRole): [string, string, string] {
  return ["Tu cuenta", role === "owner" ? "Tu mascota" : "Tu clínica", "Tu plan"];
}

/**
 * Which section the step belongs to (null on the welcome screen) and how full
 * each of the three segments is, from 0 to 1.
 */
export function progressOf(
  role: SignUpRole,
  step: StepId,
): { section: number | null; fills: [number, number, number] } {
  const sections = sectionsFor(role);
  const section = sections.findIndex((steps) => steps.includes(step));
  if (section === -1) return { section: null, fills: [0, 0, 0] };
  const fills = sections.map((steps, i) =>
    i < section ? 1 : i > section ? 0 : (steps.indexOf(step) + 1) / steps.length,
  ) as [number, number, number];
  return { section, fills };
}

export function nextStep(role: SignUpRole, step: StepId): StepId | null {
  const steps = stepsFor(role);
  return steps[steps.indexOf(step) + 1] ?? null;
}

/**
 * Where "Atrás" leads, or null when there is no way back: the account and the
 * pet already exist past `access` and `creating`, and repeating those steps
 * would create them twice.
 */
export function previousStep(
  role: SignUpRole,
  step: StepId,
  data: WizardData,
): StepId | null {
  switch (step) {
    case "role":
      return "welcome";
    case "name":
      return "role";
    case "access":
      return "name";
    case "petName":
      return "species";
    case "petDetails":
      return "petName";
    case "plans":
      if (role === "clinic") return "clinicReview";
      return data.petId ? null : "species";
    default:
      return null;
  }
}

/** The pet as the API expects it; validate with `createPetSchema` before sending. */
export function petPayload(data: WizardData): Record<string, unknown> {
  return {
    name: data.petName.trim(),
    species: data.species ?? undefined,
    sex: data.sex ?? undefined,
    birthDate: data.birthDate || undefined,
    neutered: data.neutered,
  } satisfies Partial<Record<keyof CreatePet, unknown>>;
}

/** First name, for greetings. A leading title stays with it: "Dra. Laura". */
export function firstName(name: string): string {
  const [first = "", second] = name.trim().split(/\s+/);
  return /^dra?\.?$/i.test(first) && second ? `${first} ${second}` : first;
}
