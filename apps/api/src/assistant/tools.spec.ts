import type {
  MedicalRecord,
  Pet,
  TokenPayload,
  VaccinationStatus,
} from '@vetify/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromIsoDate } from '../common/dates.js';
import {
  ageBetween,
  ASSISTANT_TOOLS,
  AssistantTools,
  daysFrom,
  TOOL_RECORD_LIMIT,
  type AssistantToolServices,
} from './tools.js';

const PET_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const CLINIC_ID = '55555555-5555-4555-8555-555555555555';
const VET_ID = '66666666-6666-4666-8666-666666666666';
const CONSULTATION_ID = '77777777-7777-4777-8777-777777777777';

const USER: TokenPayload = {
  sub: OWNER_ID,
  email: 'ana.jimenez@mail.cr',
  role: 'owner',
  sid: '99999999-9999-4999-8999-999999999999',
};

const pet: Pet = {
  id: PET_ID,
  ownerId: OWNER_ID,
  name: 'Canela',
  species: 'dog',
  breed: 'Zaguate',
  sex: 'female',
  birthDate: '2022-03-15',
  neutered: true,
  microchip: '985112003456789',
  photoUrl: 'https://res.cloudinary.com/vetify/pets/photo.jpg',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const record: MedicalRecord = {
  nextCursors: {},
  clinics: [{ id: CLINIC_ID, name: 'Clínica San Isidro' }],
  veterinarians: [{ id: VET_ID, name: 'Dra. Rojas' }],
  consultations: [
    {
      id: CONSULTATION_ID,
      petId: PET_ID,
      clinicId: CLINIC_ID,
      veterinarianId: VET_ID,
      date: '2026-10-01T15:00:00.000Z',
      reason: 'Vómito',
      diagnosis: 'Gastritis',
      notes: 'Dieta blanda',
    },
  ],
  vaccinations: [
    {
      id: '88888888-8888-4888-8888-888888888881',
      petId: PET_ID,
      vaccine: 'Rabia',
      batch: 'L-1',
      appliedOn: '2026-01-10',
      expiresOn: '2027-01-10',
      clinicId: CLINIC_ID,
      veterinarianId: VET_ID,
    },
    {
      id: '88888888-8888-4888-8888-888888888885',
      petId: PET_ID,
      vaccine: 'Moquillo',
      batch: 'M-7',
      appliedOn: '2025-03-15',
      expiresOn: '2026-03-15',
      clinicId: null,
      veterinarianId: null,
    },
    {
      id: '88888888-8888-4888-8888-888888888886',
      petId: PET_ID,
      vaccine: 'rabia ',
      batch: 'L-0',
      appliedOn: '2025-01-05',
      expiresOn: '2026-01-05',
      clinicId: CLINIC_ID,
      veterinarianId: null,
    },
  ],
  dewormings: [
    {
      id: '88888888-8888-4888-8888-888888888882',
      petId: PET_ID,
      product: 'Drontal',
      kind: 'internal',
      appliedOn: '2026-09-01',
      nextDueOn: '2026-12-01',
      clinicId: CLINIC_ID,
      veterinarianId: VET_ID,
    },
  ],
  treatments: [
    {
      id: '88888888-8888-4888-8888-888888888883',
      consultationId: CONSULTATION_ID,
      petId: PET_ID,
      description: 'Omeprazol',
      startsOn: '2026-10-01',
      endsOn: '2026-10-10',
      clinicId: CLINIC_ID,
      veterinarianId: VET_ID,
    },
  ],
  exams: [
    {
      id: '88888888-8888-4888-8888-888888888884',
      petId: PET_ID,
      kind: 'Hemograma',
      performedOn: '2026-10-01',
      fileUrl: 'https://res.cloudinary.com/vetify/exam.pdf',
      fileFormat: 'pdf',
      recordedByOwner: false,
      result: 'Normal',
      clinicId: CLINIC_ID,
      veterinarianId: VET_ID,
    },
  ],
  weightEntries: [
    {
      id: '88888888-8888-4888-8888-888888888886',
      petId: PET_ID,
      recordedOn: '2026-10-01',
      weightKg: 12.4,
    },
    {
      id: '88888888-8888-4888-8888-888888888885',
      petId: PET_ID,
      recordedOn: '2026-09-01',
      weightKg: 12,
    },
  ],
  feedingEntries: [
    {
      id: '88888888-8888-4888-8888-888888888887',
      petId: PET_ID,
      recordedOn: '2026-10-02',
      notes: 'Comió poco',
    },
  ],
};

const TODAY = fromIsoDate('2026-11-12');

const status: VaccinationStatus = {
  country: 'CR',
  species: 'dog',
  coverage: 50,
  vaccines: [
    {
      vaccine: 'Rabia',
      status: 'valid',
      lastAppliedOn: '2026-01-10',
      expiresOn: '2027-01-10',
      nextDueOn: '2027-01-10',
    },
    {
      vaccine: 'Polivalente',
      status: 'expiring',
      lastAppliedOn: '2025-11-20',
      expiresOn: '2026-11-20',
      nextDueOn: '2026-11-20',
    },
    {
      vaccine: 'Leptospirosis',
      status: 'expired',
      lastAppliedOn: '2025-03-15',
      expiresOn: '2026-03-15',
      nextDueOn: null,
    },
    {
      vaccine: 'Tos de las perreras',
      status: 'due',
      lastAppliedOn: null,
      expiresOn: null,
      nextDueOn: null,
    },
  ],
  dewormings: [
    {
      kind: 'internal',
      product: 'Drontal',
      lastAppliedOn: '2026-09-01',
      nextDueOn: '2026-12-01',
      status: 'valid',
    },
  ],
};

/** Values and keys that must never reach the language model provider. */
const FORBIDDEN_VALUES = [
  OWNER_ID,
  CLINIC_ID,
  VET_ID,
  PET_ID,
  USER.email,
  pet.name,
  pet.microchip!,
  pet.photoUrl!,
  record.exams[0]!.fileUrl!,
  'L-1',
  'M-7',
];
/** Who signed: only the vaccination history names them. */
const SIGNER_NAMES = ['Clínica San Isidro', 'Dra. Rojas'];
const SIGNER_TOOLS = new Set(['list_vaccinations']);
const FORBIDDEN_KEYS = [
  'ownerId',
  'petId',
  'clinicId',
  'veterinarianId',
  'name',
  'email',
  'phone',
  'microchip',
  'photoUrl',
  'fileUrl',
  'batch',
];

const keysOf = (value: unknown): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, inner]) => [
        ...(Array.isArray(value) ? [] : [key]),
        ...keysOf(inner),
      ])
    : [];

describe('AssistantTools', () => {
  let services: AssistantToolServices;
  let tools: AssistantTools;

  beforeEach(() => {
    services = {
      pets: { get: vi.fn().mockResolvedValue(pet) },
      records: { get: vi.fn().mockResolvedValue(record) },
      vaccinationStatus: {
        vaccinationStatus: vi.fn().mockResolvedValue(status),
      },
    };
    tools = new AssistantTools(services, USER, PET_ID, TODAY);
  });

  it('sends each vaccine status in words, computed by the API, with the days left', async () => {
    const { vaccines, dewormings } = JSON.parse(
      await tools.run('get_vaccination_status'),
    );
    expect(
      vaccines.map(
        (v: {
          vaccine: string;
          status: string;
          daysUntilExpiry: number | null;
        }) => [v.vaccine, v.status, v.daysUntilExpiry],
      ),
    ).toEqual([
      ['Rabia', 'vigente', 59],
      ['Polivalente', 'por vencer', 8],
      ['Leptospirosis', 'vencida', -242],
      ['Tos de las perreras', 'pendiente', null],
    ]);
    expect(dewormings[0]).toMatchObject({
      status: 'vigente',
      daysUntilNextDose: 19,
    });
  });

  it.each(ASSISTANT_TOOLS.map((t) => t.name))(
    '%s sends no owner data, microchip, photo or internal ids',
    async (name) => {
      const json = await tools.run(name);
      for (const value of FORBIDDEN_VALUES) expect(json).not.toContain(value);
      if (!SIGNER_TOOLS.has(name))
        for (const value of SIGNER_NAMES) expect(json).not.toContain(value);
      const keys = keysOf(JSON.parse(json));
      for (const key of FORBIDDEN_KEYS) expect(keys).not.toContain(key);
    },
  );

  it('reads through the services as the same user, for the same pet', async () => {
    await tools.run('get_pet_profile');
    await tools.run('get_vaccination_status');
    await tools.run('list_exams');
    expect(services.pets.get).toHaveBeenCalledWith(USER, PET_ID);
    expect(services.vaccinationStatus.vaccinationStatus).toHaveBeenCalledWith(
      USER,
      PET_ID,
    );
    expect(services.records.get).toHaveBeenCalledWith(USER, PET_ID, {
      limit: TOOL_RECORD_LIMIT,
      section: 'exams',
    });
  });

  it('sends the profile as species, breed, sex, neutered and age', async () => {
    const profile = JSON.parse(await tools.run('get_pet_profile'));
    expect(Object.keys(profile).sort()).toEqual(
      ['age', 'breed', 'neutered', 'sex', 'species'].sort(),
    );
    expect(profile).toMatchObject({
      species: 'dog',
      breed: 'Zaguate',
      sex: 'female',
      neutered: true,
    });
  });

  it('keeps each record with its id, date and clinical fields', async () => {
    expect(JSON.parse(await tools.run('list_consultations'))).toEqual({
      consultations: [
        {
          id: CONSULTATION_ID,
          date: '2026-10-01T15:00:00.000Z',
          reason: 'Vómito',
          diagnosis: 'Gastritis',
          notes: 'Dieta blanda',
        },
      ],
    });
    expect(JSON.parse(await tools.run('list_exams')).exams[0]).toMatchObject({
      kind: 'Hemograma',
      result: 'Normal',
      hasFile: true,
    });
    expect(
      JSON.parse(await tools.run('list_treatments')).treatments[0],
    ).toMatchObject({
      description: 'Omeprazol',
      consultationId: CONSULTATION_ID,
    });
    expect(
      JSON.parse(await tools.run('list_dewormings')).dewormings[0],
    ).toMatchObject({ product: 'Drontal', nextDueOn: '2026-12-01' });
    expect(
      JSON.parse(await tools.run('list_feeding')).feeding[0],
    ).toMatchObject({ notes: 'Comió poco' });
  });

  it('lists the real vaccination history as recorded, with who signed it', async () => {
    const { vaccinations } = JSON.parse(await tools.run('list_vaccinations'));
    expect(services.records.get).toHaveBeenCalledWith(USER, PET_ID, {
      limit: TOOL_RECORD_LIMIT,
      section: 'vaccinations',
    });
    expect(vaccinations).toEqual([
      {
        id: '88888888-8888-4888-8888-888888888881',
        vaccine: 'Rabia',
        appliedOn: '2026-01-10',
        expiresOn: '2027-01-10',
        status: 'vigente',
        daysUntilExpiry: 59,
        replacedByLaterDose: false,
        signedBy: { clinic: 'Clínica San Isidro', veterinarian: 'Dra. Rojas' },
      },
      {
        // Off the schedule: get_vaccination_status does not show it.
        id: '88888888-8888-4888-8888-888888888885',
        vaccine: 'Moquillo',
        appliedOn: '2025-03-15',
        expiresOn: '2026-03-15',
        status: 'vencida',
        daysUntilExpiry: -242,
        replacedByLaterDose: false,
        signedBy: null,
      },
      {
        id: '88888888-8888-4888-8888-888888888886',
        vaccine: 'rabia ',
        appliedOn: '2025-01-05',
        expiresOn: '2026-01-05',
        status: 'vencida',
        daysUntilExpiry: -311,
        replacedByLaterDose: true,
        signedBy: { clinic: 'Clínica San Isidro', veterinarian: null },
      },
    ]);
  });

  it('returns the weight series oldest first', async () => {
    const { weights } = JSON.parse(await tools.run('get_weight_series'));
    expect(weights.map((w: { weightKg: number }) => w.weightKg)).toEqual([
      12, 12.4,
    ]);
  });

  it('answers an unknown tool without calling any service', async () => {
    expect(JSON.parse(await tools.run('delete_pet'))).toEqual({
      error: 'Unknown tool: delete_pet',
    });
    expect(services.records.get).not.toHaveBeenCalled();
  });

  it('propagates an authorization failure from the services', async () => {
    const denied = new Error('revoked');
    vi.mocked(services.records.get).mockRejectedValueOnce(denied);
    await expect(tools.run('list_consultations')).rejects.toBe(denied);
  });

  it('defines tools without a pet id parameter', () => {
    for (const tool of ASSISTANT_TOOLS)
      expect(tool.parameters).toMatchObject({ properties: {} });
  });
});

describe('daysFrom', () => {
  it('counts whole days, negative in the past and null without a date', () => {
    expect(daysFrom(TODAY, '2026-11-12')).toBe(0);
    expect(daysFrom(TODAY, '2026-11-13')).toBe(1);
    expect(daysFrom(TODAY, '2026-11-11')).toBe(-1);
    expect(daysFrom(TODAY, null)).toBeNull();
  });
});

describe('ageBetween', () => {
  it('counts whole years and months', () => {
    expect(ageBetween('2022-03-15', '2026-11-11')).toEqual({
      years: 4,
      months: 7,
    });
    expect(ageBetween('2026-10-12', '2026-11-11')).toEqual({
      years: 0,
      months: 0,
    });
    expect(ageBetween('2025-11-11', '2026-11-11')).toEqual({
      years: 1,
      months: 0,
    });
  });

  it('is null for a birth date after today', () => {
    expect(ageBetween('2027-01-01', '2026-11-11')).toBeNull();
  });
});
