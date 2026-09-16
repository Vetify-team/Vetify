import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Mascotas del dueño. Una clínica solo las ve con permiso activo.
 *
 * Toda la lógica de negocio y TODA la autorización viven acá, nunca en el
 * controlador. Pendiente de implementar: ver .claude/skills/vetify-modulo-api.
 */
@Injectable()
export class MascotasService {
  constructor(protected readonly prisma: PrismaService) {}
}
