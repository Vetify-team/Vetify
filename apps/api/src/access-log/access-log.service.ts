import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Identical reads by the same user within this window are logged once. */
export const DEDUPE_WINDOW_MS = 5 * 60_000;

export interface AccessEntry {
  petIds: string[];
  userId: string | null;
  action: string;
  /**
   * Skip entries identical to one written in the last few minutes. Used for
   * reads, so a clinic cannot bury the owner's log by repeating a request.
   * Writes are never deduplicated.
   */
  dedupe?: boolean;
}

/**
 * Writes `access_logs`. The table is append-only: nothing here updates or
 * deletes, and the owner reads it through PermissionsService.
 */
@Injectable()
export class AccessLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record({
    petIds,
    userId,
    action,
    dedupe = false,
  }: AccessEntry): Promise<void> {
    if (!petIds.length) return;
    let pending = [...new Set(petIds)];

    if (dedupe) {
      const recent = await this.prisma.accessLog.findMany({
        where: {
          petId: { in: pending },
          userId,
          action,
          occurredAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
        },
        select: { petId: true },
      });
      const seen = new Set(recent.map((entry) => entry.petId));
      pending = pending.filter((petId) => !seen.has(petId));
    }

    if (pending.length) {
      await this.prisma.accessLog.createMany({
        data: pending.map((petId) => ({ petId, userId, action })),
      });
    }
  }

  /**
   * A denied attempt on an existing pet. Logged (deduplicated) so the owner
   * sees who tried; skipped when the pet does not exist.
   */
  async recordDenied(petId: string, userId: string | null): Promise<void> {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true },
    });
    if (pet)
      await this.record({
        petIds: [petId],
        userId,
        action: 'access_denied',
        dedupe: true,
      });
  }
}
