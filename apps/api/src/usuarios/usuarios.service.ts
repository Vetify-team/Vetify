import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Perfil del usuario autenticado.
 *
 * Toda la lógica de negocio y TODA la autorización viven acá, nunca en el
 * controlador. Pendiente de implementar.
 */
@Injectable()
export class UsuariosService {
  constructor(protected readonly prisma: PrismaService) {}
}
