import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Clínicas y su personal.
 *
 * Toda la lógica de negocio y TODA la autorización viven acá, nunca en el
 * controlador. Pendiente de implementar: ver .claude/skills/vetify-modulo-api.
 */
@Injectable()
export class ClinicasService {
  constructor(protected readonly prisma: PrismaService) {}
}
