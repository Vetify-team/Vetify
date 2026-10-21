import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@vetify/types';

export const ROLES = 'vetify:roles';

/**
 * Restricts an endpoint (or a controller) to some roles. Access to a specific
 * pet is decided in the service by PermissionsService.authorize, not here.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);
