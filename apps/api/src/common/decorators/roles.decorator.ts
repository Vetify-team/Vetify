import { SetMetadata } from '@nestjs/common';
import type { RolUsuario } from '@vetify/types';

export const CLAVE_ROLES = 'vetify:roles';

/** Restringe un endpoint a ciertos roles. La verificación fina de permisos
 *  sobre una mascota se hace en el servicio, no acá. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(CLAVE_ROLES, roles);
