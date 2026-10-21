import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Weight anomalies, consultation reason classification and pre-visit
 * summaries. Not implemented yet; it will authorize through
 * PermissionsService like every other module that reads a record.
 */
@Injectable()
export class AiService {
  constructor(protected readonly prisma: PrismaService) {}
}
