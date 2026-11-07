import { CanActivate, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TokenPayload, UserRole } from '@vetify/types';
import { ROLES } from '../decorators/roles.decorator.js';
import { forbidden } from '../errors.js';

/**
 * Filters by role. It does NOT authorize access to a specific pet: whether a
 * clinic holds an active permission is always checked in the service.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const role = context.switchToHttp().getRequest<{ user?: TokenPayload }>()
      .user?.role;
    if (!role || !required.includes(role)) throw forbidden();
    return true;
  }
}
