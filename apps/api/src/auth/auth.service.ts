import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Registro, login, refresco rotado de sesión y hash de contraseñas con argon2.
 *
 * Toda la lógica de negocio y TODA la autorización viven acá, nunca en el
 * controlador. Pendiente de implementar: ver .claude/skills/vetify-modulo-api.
 */
@Injectable()
export class AuthService {
  constructor(protected readonly prisma: PrismaService) {}
}
