import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolUsuario, TokenPayload } from '@vetify/types';
import { CLAVE_ROLES } from '../decorators/roles.decorator.js';

/**
 * Filtra por rol (dueño / clínica). OJO: esto NO autoriza el acceso a una
 * mascota concreta. Que una clínica tenga un permiso activo se comprueba
 * siempre en el servicio del módulo correspondiente.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[]>(CLAVE_ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    if (!rolesRequeridos?.length) return true;

    const peticion = contexto.switchToHttp().getRequest<{ user?: TokenPayload }>();
    const rol = peticion.user?.rol;

    if (!rol || !rolesRequeridos.includes(rol)) {
      throw new ForbiddenException('No tenés permiso para realizar esta acción');
    }

    return true;
  }
}
