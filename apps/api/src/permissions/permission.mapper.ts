import type { Permission } from '@vetify/types';
import { toIsoDateTime } from '../common/dates.js';
import type { Permission as PermissionRow } from '../generated/prisma/client.js';

export const toPermission = (permission: PermissionRow): Permission => ({
  id: permission.id,
  petId: permission.petId,
  clinicId: permission.clinicId,
  scope: permission.scope,
  status: permission.status,
  createdAt: toIsoDateTime(permission.createdAt),
});
