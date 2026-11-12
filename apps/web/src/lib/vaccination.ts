import type { VaccinationStatus } from "@vetify/types";

/**
 * The vaccines with a recorded dose. A scheduled vaccine never applied is not
 * shown anywhere (schedule, carné, PDF), so a new pet starts empty.
 */
export const recordedVaccines = (status: VaccinationStatus) =>
  status.vaccines.filter((v) => v.lastAppliedOn);
