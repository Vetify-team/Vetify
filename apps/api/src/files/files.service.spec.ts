import type { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '@vetify/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config.js';
import type { PermissionsService } from '../permissions/permissions.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { signParams } from './cloudinary.js';
import { FilesService } from './files.service.js';

const PET = '11111111-1111-4111-8111-111111111111';
const OTHER_PET = '33333333-3333-4333-8333-333333333333';
const FILE = '22222222-2222-4222-8222-222222222222';
const SECRET = 'test-secret-not-real';
const owner: TokenPayload = {
  sub: '44444444-4444-4444-8444-444444444444',
  email: 'ana@example.test',
  role: 'owner',
  sid: '55555555-5555-4555-8555-555555555555',
};

const config = (url: string) =>
  ({ get: () => url }) as unknown as ConfigService<Env, true>;

describe('FilesService', () => {
  const authorize = vi.fn();
  const findFirst = vi.fn();
  const permissions = { authorize } as unknown as PermissionsService;
  const prisma = { exam: { findFirst } } as unknown as PrismaService;
  const fetchMock = vi.fn();
  let files: FilesService;

  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockResolvedValue({ pet: { id: PET }, clinicId: null });
    vi.stubGlobal('fetch', fetchMock);
    files = new FilesService(
      config(`cloudinary://123456789012345:${SECRET}@demo-cloud`),
      prisma,
      permissions,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const resource = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status }),
    );

  describe('createUpload', () => {
    it('signs one new file under the pet, with its formats and no overwrite', async () => {
      const ticket = await files.createUpload(owner, PET, {
        purpose: 'exam_file',
        contentType: 'application/pdf',
        size: 1000,
      });
      expect(authorize).toHaveBeenCalledWith(owner, PET, 'record_exam');
      expect(ticket.url).toBe(
        'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
      );
      expect(ticket.fileId).toMatch(
        new RegExp(`^pets/${PET}/exams/[0-9a-f-]{36}$`),
      );
      const { signature, api_key, ...signed } = ticket.fields;
      expect(api_key).toBe('123456789012345');
      expect(signed).toMatchObject({
        public_id: ticket.fileId,
        type: 'authenticated',
        overwrite: 'false',
        allowed_formats: 'pdf,jpg,png,webp,heic',
      });
      expect(signature).toBe(signParams(signed, SECRET));
    });

    it('asks the owner permission to administer the pet for a photo', async () => {
      await files.createUpload(owner, PET, {
        purpose: 'pet_photo',
        contentType: 'image/png',
        size: 1000,
      });
      expect(authorize).toHaveBeenCalledWith(owner, PET, 'administer');
    });

    it('refuses before signing when the pet is not accessible', async () => {
      authorize.mockRejectedValueOnce(new Error('not found'));
      await expect(
        files.createUpload(owner, OTHER_PET, {
          purpose: 'pet_photo',
          contentType: 'image/png',
          size: 1000,
        }),
      ).rejects.toThrow('not found');
    });

    it('rejects other types and sizes over the limit', async () => {
      await expect(
        files.createUpload(owner, PET, {
          purpose: 'pet_photo',
          contentType: 'application/pdf',
          size: 1000,
        }),
      ).rejects.toMatchObject({ details: { reason: 'FILE_TYPE_NOT_ALLOWED' } });
      await expect(
        files.createUpload(owner, PET, {
          purpose: 'pet_photo',
          contentType: 'image/png',
          size: 5 * 1024 * 1024 + 1,
        }),
      ).rejects.toMatchObject({ details: { reason: 'FILE_TOO_LARGE' } });
      await expect(
        files.createUpload(owner, PET, {
          purpose: 'exam_file',
          contentType: 'toString',
          size: 1,
        }),
      ).rejects.toMatchObject({ details: { reason: 'FILE_TYPE_NOT_ALLOWED' } });
    });

    it('answers 503 when storage is not configured', async () => {
      files = new FilesService(config(''), prisma, permissions);
      await expect(
        files.createUpload(owner, PET, {
          purpose: 'pet_photo',
          contentType: 'image/png',
          size: 1,
        }),
      ).rejects.toMatchObject({ code: 'UPLOADS_UNAVAILABLE' });
    });
  });

  describe('verify', () => {
    it('rejects a file issued for another pet or purpose without asking storage', async () => {
      await expect(
        files.verify(PET, 'exam_file', `pets/${OTHER_PET}/exams/${FILE}`),
      ).rejects.toMatchObject({ details: { reason: 'FILE_NOT_UPLOADED' } });
      await expect(
        files.verify(PET, 'exam_file', `pets/${PET}/photo/${FILE}`),
      ).rejects.toMatchObject({ details: { reason: 'FILE_NOT_UPLOADED' } });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a file that was never uploaded', async () => {
      resource({ error: { message: 'Resource not found' } }, 404);
      await expect(
        files.verify(PET, 'exam_file', `pets/${PET}/exams/${FILE}`),
      ).rejects.toMatchObject({ details: { reason: 'FILE_NOT_UPLOADED' } });
    });

    it('deletes and rejects a stored file over the size limit', async () => {
      resource({ bytes: 5 * 1024 * 1024 + 1, format: 'jpg' });
      resource({ deleted: {} });
      await expect(
        files.verify(PET, 'pet_photo', `pets/${PET}/photo/${FILE}`),
      ).rejects.toMatchObject({ details: { reason: 'FILE_TOO_LARGE' } });
      const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(init.method).toBe('DELETE');
      expect(new URL(url).searchParams.getAll('public_ids[]')).toEqual([
        `pets/${PET}/photo/${FILE}`,
      ]);
    });

    it('deletes and rejects a stored file of another format', async () => {
      resource({ bytes: 100, format: 'pdf' });
      resource({ deleted: {} });
      await expect(
        files.verify(PET, 'pet_photo', `pets/${PET}/photo/${FILE}`),
      ).rejects.toMatchObject({ details: { reason: 'FILE_TYPE_NOT_ALLOWED' } });
    });

    it('returns the format of a valid file', async () => {
      resource({ bytes: 100, format: 'pdf' });
      await expect(
        files.verify(PET, 'exam_file', `pets/${PET}/exams/${FILE}`),
      ).resolves.toEqual({ format: 'pdf' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        `https://api.cloudinary.com/v1_1/demo-cloud/resources/image/authenticated/pets/${PET}/exams/${FILE}`,
      );
      expect((init.headers as Record<string, string>).Authorization).toMatch(
        /^Basic /,
      );
    });
  });

  describe('examFileLink', () => {
    it('authorizes the pet and signs a link that expires in five minutes', async () => {
      findFirst.mockResolvedValueOnce({
        fileId: `pets/${PET}/exams/${FILE}`,
        fileFormat: 'pdf',
      });
      const before = Math.floor(Date.now() / 1000);
      const link = await files.examFileLink(owner, PET, FILE);
      expect(authorize).toHaveBeenCalledWith(owner, PET, 'read');
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: FILE, petId: PET },
      });
      const expires = Number(new URL(link.url).searchParams.get('expires_at'));
      expect(expires - before).toBeGreaterThanOrEqual(300);
      expect(expires - before).toBeLessThanOrEqual(301);
    });

    it('answers 404 for an exam of another pet or without a file', async () => {
      findFirst.mockResolvedValueOnce(null);
      await expect(files.examFileLink(owner, PET, FILE)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('never signs for a caller without read access', async () => {
      authorize.mockRejectedValueOnce(new Error('forbidden'));
      await expect(files.examFileLink(owner, OTHER_PET, FILE)).rejects.toThrow(
        'forbidden',
      );
      expect(findFirst).not.toHaveBeenCalled();
    });
  });

  it('deletes every file under each deleted pet', async () => {
    resource({ partial: true });
    resource({ partial: false });
    resource({});
    await files.deletePetFiles([PET, OTHER_PET]);
    const prefixes = fetchMock.mock.calls.map(([url]) =>
      new URL(url as string).searchParams.get('prefix'),
    );
    expect(prefixes).toEqual([
      `pets/${PET}/`,
      `pets/${PET}/`,
      `pets/${OTHER_PET}/`,
    ]);
  });

  it('shows a signed thumbnail for an uploaded photo and the old link otherwise', () => {
    expect(
      files.photoUrl({ photoId: `pets/${PET}/photo/${FILE}`, photoUrl: null }),
    ).toMatch(
      /^https:\/\/res\.cloudinary\.com\/demo-cloud\/image\/authenticated\/s--[\w-]{8}--\//,
    );
    expect(
      files.photoUrl({ photoId: null, photoUrl: 'https://example.com/a.png' }),
    ).toBe('https://example.com/a.png');
  });
});
