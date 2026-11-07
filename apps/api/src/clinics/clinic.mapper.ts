import type { Clinic } from '@vetify/types';
import { toIsoDateTime } from '../common/dates.js';
import type { Clinic as ClinicRow } from '../generated/prisma/client.js';

export const toClinic = (clinic: ClinicRow): Clinic => ({
  id: clinic.id,
  name: clinic.name,
  address: clinic.address,
  country: clinic.country,
  plan: clinic.plan,
  vetCount: clinic.vetCount,
  verified: clinic.verified,
  createdAt: toIsoDateTime(clinic.createdAt),
});
