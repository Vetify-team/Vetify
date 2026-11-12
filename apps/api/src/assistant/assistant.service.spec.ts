import type { ConfigService } from '@nestjs/config';
import type { AssistantRequest, Pet, TokenPayload } from '@vetify/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingService } from '../billing/billing.service.js';
import type { LinkCodesService } from '../clinics/link-codes.service.js';
import { startOfMonthInCostaRica } from '../common/dates.js';
import { AppException } from '../common/errors.js';
import type { Env } from '../config.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import type { PetsService } from '../pets/pets.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RecordsService } from '../records/records.service.js';
import type { VaccinationStatusService } from '../records/vaccination-status.service.js';
import { AssistantService, MAX_ROUNDS } from './assistant.service.js';
import {
  assistantUnavailable,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
} from './llm.client.js';
import { FALLBACK_REPLY } from './prompts.js';
import { EMERGENCY_REPLY } from './safety.js';

const PET_ID = '11111111-1111-4111-8111-111111111111';
const SID = '99999999-9999-4999-8999-999999999999';
const OWNER: TokenPayload = {
  sub: '22222222-2222-4222-8222-222222222222',
  email: 'ana@mail.cr',
  role: 'owner',
  sid: SID,
};
const OTHER_OWNER: TokenPayload = {
  ...OWNER,
  sub: '33333333-3333-4333-8333-333333333333',
};
const CLINIC: TokenPayload = {
  sub: '44444444-4444-4444-8444-444444444444',
  email: 'vet@clinic.cr',
  role: 'clinic',
  sid: SID,
};
const CLINIC_ID = '55555555-5555-4555-8555-555555555555';

const petRow = { id: PET_ID, ownerId: OWNER.sub, species: 'dog' };
const petDto = {
  id: PET_ID,
  ownerId: OWNER.sub,
  name: 'Canela',
  species: 'dog',
  breed: null,
  sex: null,
  birthDate: null,
  neutered: false,
  microchip: null,
  photoUrl: null,
  createdAt: '2024-01-01T00:00:00.000Z',
} satisfies Pet;

const ask = (content: string): AssistantRequest => ({
  messages: [{ role: 'user', content }],
});

const text = (content: string, tokens = 10): LlmResponse => ({
  content,
  toolCalls: [],
  usage: { promptTokens: tokens, completionTokens: tokens },
});
const callTools = (...names: string[]): LlmResponse => ({
  content: null,
  toolCalls: names.map((name, i) => ({
    id: `call_${i}`,
    name,
    arguments: '{}',
  })),
  usage: { promptTokens: 5, completionTokens: 1 },
});

const failure = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  if (!(error instanceof AppException)) throw new Error('Expected an error');
  return {
    status: error.getStatus(),
    ...(error.getResponse() as { code: string; reason?: string }),
  };
};

describe('AssistantService', () => {
  let prisma: {
    pet: { findUnique: ReturnType<typeof vi.fn> };
    permission: { findFirst: ReturnType<typeof vi.fn> };
    assistantUsage: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let llm: { enabled: boolean; complete: ReturnType<typeof vi.fn> };
  let billing: {
    enabled: boolean;
    currentPlan: ReturnType<typeof vi.fn>;
  };
  let records: { get: ReturnType<typeof vi.fn> };
  let service: AssistantService;
  const settings: Partial<Env> = { ASSISTANT_FREE_MONTHLY_MESSAGES: 30 };

  beforeEach(() => {
    prisma = {
      pet: { findUnique: vi.fn().mockResolvedValue(petRow) },
      permission: { findFirst: vi.fn().mockResolvedValue(null) },
      assistantUsage: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    llm = { enabled: true, complete: vi.fn() };
    billing = {
      enabled: true,
      currentPlan: vi.fn().mockResolvedValue({ plan: 'free', until: null }),
    };
    records = {
      get: vi.fn().mockResolvedValue({
        consultations: [],
        exams: [],
        feedingEntries: [],
        weightEntries: [],
      }),
    };
    service = new AssistantService(
      prisma as unknown as PrismaService,
      new PermissionsService(
        prisma as unknown as PrismaService,
        {} as LinkCodesService,
      ),
      billing as unknown as BillingService,
      llm as unknown as LlmClient,
      { get: vi.fn().mockResolvedValue(petDto) } as unknown as PetsService,
      records as unknown as RecordsService,
      {
        vaccinationStatus: vi.fn(),
      } as unknown as VaccinationStatusService,
      {
        get: (key: keyof Env) => settings[key],
      } as unknown as ConfigService<Env, true>,
    );
  });

  describe('authorization', () => {
    it('answers another owner 404 without calling the model', async () => {
      expect(
        await failure(service.reply(OTHER_OWNER, PET_ID, ask('Hola'))),
      ).toMatchObject({ status: 404, code: 'NOT_FOUND' });
      expect(llm.complete).not.toHaveBeenCalled();
    });

    it('rejects a clinic without an active permission like the record does', async () => {
      expect(
        await failure(service.reply(CLINIC, PET_ID, ask('Resumen'))),
      ).toMatchObject({ status: 403, code: 'FORBIDDEN' });
      expect(llm.complete).not.toHaveBeenCalled();
    });

    it('authorizes before saying the assistant is off', async () => {
      llm.enabled = false;
      expect(
        await failure(service.reply(OTHER_OWNER, PET_ID, ask('Hola'))),
      ).toMatchObject({ status: 404 });
      expect(
        await failure(service.reply(OWNER, PET_ID, ask('Hola'))),
      ).toMatchObject({
        status: 503,
        code: 'ASSISTANT_UNAVAILABLE',
        reason: 'ASSISTANT_DISABLED',
      });
    });
  });

  describe('tool loop', () => {
    it('runs the tools the model asks for and returns its answer', async () => {
      llm.complete
        .mockResolvedValueOnce(
          callTools('list_consultations', 'get_weight_series'),
        )
        .mockResolvedValueOnce(text('Su última consulta fue el 2026-10-01.'));

      const result = await service.reply(OWNER, PET_ID, ask('¿Cómo está?'));

      expect(result).toEqual({
        reply: 'Su última consulta fue el 2026-10-01.',
        urgent: false,
        usage: { used: 1, limit: 30 },
      });
      expect(records.get).toHaveBeenCalledWith(
        OWNER,
        PET_ID,
        expect.objectContaining({ section: 'consultations' }),
      );
      const second = llm.complete.mock.calls[1]![0] as LlmRequest;
      expect(second.messages.at(-2)).toMatchObject({
        role: 'tool',
        toolCallId: 'call_0',
      });
      expect(second.messages.at(-1)).toMatchObject({
        role: 'tool',
        toolCallId: 'call_1',
      });
      expect(prisma.assistantUsage.create).toHaveBeenCalledWith({
        data: {
          userId: OWNER.sub,
          petId: PET_ID,
          promptTokens: 15,
          completionTokens: 11,
        },
      });
    });

    it('uses the owner prompt for owners and the clinical one for clinics', async () => {
      prisma.permission.findFirst.mockResolvedValue({
        pet: petRow,
        clinicId: CLINIC_ID,
      });
      llm.complete.mockResolvedValue(text('Listo'));
      await service.reply(OWNER, PET_ID, ask('Hola'));
      await service.reply(CLINIC, PET_ID, ask('Hola'));
      const [owner, clinic] = llm.complete.mock.calls.map(
        ([request]) => (request as LlmRequest).messages[0]!,
      );
      expect(owner).toMatchObject({ role: 'system' });
      expect(owner!.content).toMatch(/dueños de mascotas/);
      expect(owner!.content).toMatch(/Nunca des dosis/);
      expect(clinic!.content).toMatch(/asistente clínico/);
      expect(clinic!.content).toMatch(/resumen pre-consulta/);
    });

    it(`stops after ${MAX_ROUNDS} model calls, the last one without tools`, async () => {
      llm.complete.mockResolvedValue(callTools('list_exams'));

      const result = await service.reply(OWNER, PET_ID, ask('Exámenes'));

      expect(llm.complete).toHaveBeenCalledTimes(MAX_ROUNDS);
      const calls = llm.complete.mock.calls.map(
        ([request]) => request as LlmRequest,
      );
      expect(calls.slice(0, -1).every((r) => r.tools?.length)).toBe(true);
      expect(calls.at(-1)!.tools).toBeUndefined();
      expect(result.reply).toBe(FALLBACK_REPLY);
      expect(prisma.assistantUsage.create).toHaveBeenCalledTimes(1);
    });

    it('answers extra tool calls of one round as skipped', async () => {
      llm.complete
        .mockResolvedValueOnce(callTools(...Array(10).fill('list_feeding')))
        .mockResolvedValueOnce(text('Listo'));
      await service.reply(OWNER, PET_ID, ask('Comida'));
      expect(records.get).toHaveBeenCalledTimes(8);
      const second = llm.complete.mock.calls[1]![0] as LlmRequest;
      expect(second.messages.at(-1)!.content).toMatch(/Too many tool calls/);
    });

    it('falls back when the model answers with empty text', async () => {
      llm.complete.mockResolvedValueOnce(text('   '));
      expect((await service.reply(OWNER, PET_ID, ask('Hola'))).reply).toBe(
        FALLBACK_REPLY,
      );
    });
  });

  describe('provider errors', () => {
    it('turns a provider failure into 503 and counts nothing', async () => {
      llm.complete.mockRejectedValueOnce(assistantUnavailable());
      expect(
        await failure(service.reply(OWNER, PET_ID, ask('Hola'))),
      ).toMatchObject({
        status: 503,
        code: 'ASSISTANT_UNAVAILABLE',
        reason: 'ASSISTANT_UNAVAILABLE',
      });
      expect(prisma.assistantUsage.create).not.toHaveBeenCalled();
    });

    it('fails the same way when the provider breaks mid-loop', async () => {
      llm.complete
        .mockResolvedValueOnce(callTools('get_pet_profile'))
        .mockRejectedValueOnce(assistantUnavailable());
      expect(
        (await failure(service.reply(OWNER, PET_ID, ask('Hola')))).status,
      ).toBe(503);
    });
  });

  describe('emergencies', () => {
    it('answers an owner with the fixed message without calling the model', async () => {
      const result = await service.reply(
        OWNER,
        PET_ID,
        ask('Mi perro está convulsionando'),
      );
      expect(result).toEqual({
        reply: EMERGENCY_REPLY,
        urgent: true,
        usage: { used: 0, limit: 30 },
      });
      expect(llm.complete).not.toHaveBeenCalled();
      expect(prisma.assistantUsage.create).not.toHaveBeenCalled();
    });

    it('answers it even over the monthly limit', async () => {
      prisma.assistantUsage.count.mockResolvedValue(30);
      expect(
        (await service.reply(OWNER, PET_ID, ask('Comió veneno'))).reply,
      ).toBe(EMERGENCY_REPLY);
    });

    it('only flags it for a clinic and still asks the model', async () => {
      prisma.permission.findFirst.mockResolvedValue({
        pet: petRow,
        clinicId: CLINIC_ID,
      });
      llm.complete.mockResolvedValueOnce(text('Diferenciales: …'));
      const result = await service.reply(
        CLINIC,
        PET_ID,
        ask('Paciente con convulsiones desde ayer'),
      );
      expect(result).toMatchObject({ urgent: true, reply: 'Diferenciales: …' });
      expect(llm.complete).toHaveBeenCalledTimes(1);
    });

    it('checks only the last message', async () => {
      llm.complete.mockResolvedValueOnce(text('Qué bueno que ya está bien.'));
      const result = await service.reply(OWNER, PET_ID, {
        messages: [
          { role: 'user', content: 'Ayer convulsionó' },
          { role: 'assistant', content: EMERGENCY_REPLY },
          {
            role: 'user',
            content: 'Ya lo vio el veterinario, ¿qué le doy de comer?',
          },
        ],
      });
      expect(result.urgent).toBe(false);
      expect(llm.complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('plan limit', () => {
    it('answers 429 ASSISTANT_LIMIT on the free plan without calling the model', async () => {
      prisma.assistantUsage.count.mockResolvedValue(30);
      expect(
        await failure(service.reply(OWNER, PET_ID, ask('Hola'))),
      ).toMatchObject({
        status: 429,
        code: 'RATE_LIMITED',
        reason: 'ASSISTANT_LIMIT',
      });
      expect(llm.complete).not.toHaveBeenCalled();
    });

    it('counts this calendar month in Costa Rica', async () => {
      llm.complete.mockResolvedValueOnce(text('Hola'));
      await service.reply(OWNER, PET_ID, ask('Hola'));
      expect(prisma.assistantUsage.count).toHaveBeenCalledWith({
        where: {
          userId: OWNER.sub,
          createdAt: { gte: startOfMonthInCostaRica() },
        },
      });
    });

    it('does not cap Premium owners', async () => {
      billing.currentPlan.mockResolvedValue({
        plan: 'premium',
        until: new Date(Date.now() + 86_400_000),
      });
      prisma.assistantUsage.count.mockResolvedValue(500);
      llm.complete.mockResolvedValueOnce(text('Hola'));
      expect((await service.reply(OWNER, PET_ID, ask('Hola'))).usage).toEqual({
        used: 501,
        limit: null,
      });
    });

    it('does not cap the free plan while payments are off', async () => {
      billing.enabled = false;
      prisma.assistantUsage.count.mockResolvedValue(30);
      llm.complete.mockResolvedValueOnce(text('Hola'));
      expect(
        (await service.reply(OWNER, PET_ID, ask('Hola'))).usage.limit,
      ).toBeNull();
    });

    it('does not cap clinics', async () => {
      prisma.permission.findFirst.mockResolvedValue({
        pet: petRow,
        clinicId: CLINIC_ID,
      });
      prisma.assistantUsage.count.mockResolvedValue(1000);
      llm.complete.mockResolvedValueOnce(text('Hola'));
      expect(
        (await service.reply(CLINIC, PET_ID, ask('Hola'))).usage.limit,
      ).toBeNull();
      expect(billing.currentPlan).not.toHaveBeenCalled();
    });
  });
});

describe('startOfMonthInCostaRica', () => {
  it('is the 1st at 00:00 in Costa Rica (06:00 UTC)', () => {
    expect(
      startOfMonthInCostaRica(new Date('2026-11-11T12:00:00Z')).toISOString(),
    ).toBe('2026-11-01T06:00:00.000Z');
  });

  it('still counts the previous month on the evening of its last day', () => {
    // 2026-12-01 03:00 UTC is still November 30 at 21:00 in Costa Rica.
    expect(
      startOfMonthInCostaRica(new Date('2026-12-01T03:00:00Z')).toISOString(),
    ).toBe('2026-11-01T06:00:00.000Z');
  });

  it('rolls over at local midnight across a year', () => {
    expect(
      startOfMonthInCostaRica(new Date('2027-01-01T06:00:00Z')).toISOString(),
    ).toBe('2027-01-01T06:00:00.000Z');
  });
});
