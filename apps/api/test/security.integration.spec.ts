import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { ConfigService } from '@nestjs/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  recordQuerySchema,
  recordSectionSchema,
  type TokenPayload,
} from '@vetify/types';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { PermissionsService } from '../src/permissions/permissions.service.js';
import { RecordsService } from '../src/records/records.service.js';
import { AccessLogService } from '../src/access-log/access-log.service.js';
import type { LinkCodesService } from '../src/clinics/link-codes.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { Env } from '../src/config.js';
import { computeVaccinationStatus } from '../src/records/vaccination.js';
import { todayInCostaRica } from '../src/common/dates.js';

// This suite must NEVER run against the app's DATABASE_URL. Use a migrated,
// disposable local database whose name explicitly identifies security tests.
const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const settings: Record<string, string> = {
  JWT_ACCESS_SECRET: 'integration-access-secret-'.repeat(2),
  JWT_REFRESH_SECRET: 'integration-refresh-secret-'.repeat(2),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
};
const config = {
  get: (key: string) => settings[key],
} as unknown as ConfigService<Env, true>;

describe.skipIf(!databaseUrl)('PostgreSQL security regressions', () => {
  let db: PrismaClient;
  let prisma: PrismaService;
  let auth: AuthService;
  let jwt: JwtService;
  let records: RecordsService;
  const users: string[] = [];

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/vetify_security_[a-z0-9_]+$/.test(url.pathname)
    ) {
      throw new Error(
        'Security integration tests require a local vetify_security_* database',
      );
    }
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl! }),
    });
    await db.$connect();
    prisma = db as unknown as PrismaService;
    jwt = new JwtService();
    auth = new AuthService(prisma, jwt, config);
    const access = new AccessLogService(prisma);
    const permissions = new PermissionsService(prisma, {} as LinkCodesService);
    records = new RecordsService(prisma, permissions, access);
  });
  afterAll(async () => {
    if (db) {
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.$disconnect();
    }
  });

  const account = async () => {
    const issued = await auth.signUp({
      email: `security-${randomUUID()}@example.test`,
      password: 'integration-test-password',
      name: 'Security test',
      role: 'owner',
    });
    users.push(issued.session.user.id);
    return issued;
  };
  const identity = (token: string) => jwt.decode<TokenPayload>(token);

  it('serializes competing refreshes and commits replay revocation of the winner', async () => {
    const original = await account();
    const attempts = await Promise.allSettled([
      auth.refresh(original.refreshToken),
      auth.refresh(original.refreshToken),
    ]);
    const successes = attempts.filter(
      (attempt) => attempt.status === 'fulfilled',
    );
    expect(successes).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await db.refreshSession.count({
        where: { userId: original.session.user.id, revokedAt: null },
      }),
    ).toBe(0);
    const winner = successes[0]!;
    if (winner.status !== 'fulfilled') throw new Error('Missing winner');
    const strategy = new JwtStrategy(config, prisma);
    await expect(
      strategy.validate(identity(winner.value.session.accessToken)),
    ).rejects.toThrow();
  });

  it('does not leave a successor active when refresh and logout race', async () => {
    const original = await account();
    await Promise.allSettled([
      auth.refresh(original.refreshToken),
      auth.logOut(original.refreshToken),
    ]);
    expect(
      await db.refreshSession.count({
        where: { userId: original.session.user.id, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('rolls back revocation if issuing the replacement fails', async () => {
    const original = await account();
    const signing = vi
      .spyOn(jwt, 'signAsync')
      .mockRejectedValueOnce(new Error('signer unavailable'));
    await expect(auth.refresh(original.refreshToken)).rejects.toThrow(
      'signer unavailable',
    );
    signing.mockRestore();
    expect(
      await db.refreshSession.count({
        where: { userId: original.session.user.id, revokedAt: null },
      }),
    ).toBe(1);
    await expect(auth.refresh(original.refreshToken)).resolves.toBeDefined();
  });

  it('does not issue a privileged session from credentials read before an admin promotion', async () => {
    const original = await account();
    const staleUser = await db.user.findUniqueOrThrow({
      where: { id: original.session.user.id },
    });
    await db.user.update({
      where: { id: staleUser.id },
      data: {
        role: 'admin',
        passwordHash: await argon2.hash('replacement-admin-password'),
      },
    });
    await db.refreshSession.updateMany({
      where: { userId: staleUser.id },
      data: { revokedAt: new Date() },
    });
    // Model a login that read the old hash just before the promotion committed.
    const read = vi
      .spyOn(db.user, 'findUnique')
      .mockResolvedValueOnce(staleUser);
    try {
      await expect(
        auth.logIn({
          email: staleUser.email,
          password: 'integration-test-password',
        }),
      ).rejects.toMatchObject({ status: 401 });
    } finally {
      read.mockRestore();
    }
    expect(
      await db.refreshSession.count({
        where: { userId: staleUser.id, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('paginates every history with tied dates without duplicates or missing entries', async () => {
    const owner = await account();
    const actor = identity(owner.session.accessToken);
    const pet = await db.pet.create({
      data: { ownerId: actor.sub, name: 'Paged', species: 'dog' },
    });
    const date = new Date('2026-01-01T00:00:00Z');
    const seeds = Array.from({ length: 17 }, () => ({
      id: randomUUID(),
      petId: pet.id,
    }));
    await db.consultation.createMany({
      data: seeds.map((row) => ({ ...row, date })),
    });
    await db.vaccination.createMany({
      data: seeds.map((row) => ({ ...row, vaccine: 'Rabia', appliedOn: date })),
    });
    await db.deworming.createMany({
      data: seeds.map((row) => ({ ...row, appliedOn: date, kind: 'internal' })),
    });
    await db.treatment.createMany({
      data: seeds.map((row, index) => ({
        ...row,
        description: 'Treatment',
        startsOn: index % 2 ? date : null,
      })),
    });
    await db.exam.createMany({
      data: seeds.map((row) => ({ ...row, performedOn: date })),
    });
    await db.weightEntry.createMany({
      data: seeds.map((row) => ({ ...row, recordedOn: date, weightKg: 12 })),
    });
    await db.feedingEntry.createMany({
      data: seeds.map((row) => ({ ...row, recordedOn: date })),
    });

    for (const section of recordSectionSchema.options) {
      let cursor: string | undefined;
      const ids: string[] = [];
      for (let page = 0; page < 5; page++) {
        const result = await records.get(actor, pet.id, {
          section,
          cursor,
          limit: 5,
        });
        expect(result[section].length).toBeLessThanOrEqual(5);
        expect(
          recordSectionSchema.options
            .filter((key) => key !== section)
            .every((key) => result[key].length === 0),
        ).toBe(true);
        ids.push(...result[section].map((row) => row.id));
        cursor = result.nextCursors[section];
        if (!cursor) break;
      }
      expect(ids).toHaveLength(17);
      expect(new Set(ids)).toEqual(new Set(seeds.map((row) => row.id)));
    }
    const other = await account();
    await expect(
      records.get(identity(other.session.accessToken), pet.id, { limit: 5 }),
    ).rejects.toMatchObject({ status: 404 });
    const foreignPet = await db.pet.create({
      data: { ownerId: other.session.user.id, name: 'Private', species: 'dog' },
    });
    const foreign = await db.feedingEntry.create({
      data: { petId: foreignPet.id, recordedOn: date },
    });
    const result = await records.get(actor, pet.id, {
      section: 'feedingEntries',
      cursor: foreign.id,
      limit: 5,
    });
    expect(result.feedingEntries).toEqual([]);
  });

  it('computes the same vaccination status from bounded latest-dose queries as from full history', async () => {
    const owner = await account();
    const actor = identity(owner.session.accessToken);
    const pet = await db.pet.create({
      data: { ownerId: actor.sub, name: 'Latest doses', species: 'dog' },
    });
    const old = new Date('2020-01-01T00:00:00Z');
    const recent = todayInCostaRica();
    await db.vaccination.createMany({
      data: [
        ...Array.from({ length: 180 }, (_, i) => ({
          petId: pet.id,
          vaccine: i % 2 ? 'Rabia' : 'Vaccine outside the schedule',
          appliedOn: old,
        })),
        { petId: pet.id, vaccine: 'RÁBIA', appliedOn: recent },
      ],
    });
    await db.deworming.createMany({
      data: [
        ...Array.from({ length: 180 }, (_, i) => ({
          petId: pet.id,
          kind: i % 2 ? 'internal' : 'external',
          appliedOn: old,
        })),
        {
          petId: pet.id,
          kind: 'internal',
          product: 'Latest product',
          appliedOn: recent,
        },
      ],
    });
    const expected = computeVaccinationStatus({
      country: 'CR',
      species: 'dog',
      birthDate: null,
      today: recent,
      schedule: await db.vaccinationRule.findMany({
        where: { country: 'CR', species: 'dog' },
        orderBy: { minAgeMonths: 'asc' },
      }),
      applied: await db.vaccination.findMany({ where: { petId: pet.id } }),
      dewormings: await db.deworming.findMany({ where: { petId: pet.id } }),
    });
    expect(await records.vaccinationStatus(actor, pet.id)).toEqual(expected);
  });

  it('validates limits and requires a section with a cursor', () => {
    expect(recordQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(recordQuerySchema.safeParse({ limit: -1 }).success).toBe(false);
    expect(recordQuerySchema.safeParse({ cursor: randomUUID() }).success).toBe(
      false,
    );
    expect(
      recordQuerySchema.safeParse({ section: 'passwordHash' }).success,
    ).toBe(false);
  });
});
