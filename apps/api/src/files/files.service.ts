import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  allowedFormats,
  FILE_FOLDERS,
  UPLOAD_LIMITS,
  type CreateUpload,
  type FileLink,
  type TokenPayload,
  type UploadPurpose,
  type UploadTicket,
} from '@vetify/types';
import { AppException, badRequest, notFound } from '../common/errors.js';
import type { Env } from '../config.js';
import type { Pet as PetRow } from '../generated/prisma/client.js';
import {
  PermissionsService,
  type Operation,
} from '../permissions/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  basicAuth,
  parseCloudinaryUrl,
  privateDownloadUrl,
  resourcesUrl,
  signedImageUrl,
  signParams,
  STORAGE_TYPE,
  uploadUrl,
  type CloudinaryCredentials,
} from './cloudinary.js';

/** Cloudinary accepts a signed upload for one hour after its timestamp. */
const UPLOAD_WINDOW_S = 60 * 60;
/** Lifetime of a link to read an exam file. */
const READ_LINK_S = 5 * 60;
const PHOTO_TRANSFORMATION = 'c_fill,g_auto,h_512,q_auto,w_512';

/** Who may upload for each purpose, as in PermissionsService.authorize. */
const UPLOAD_OPERATION = {
  pet_photo: 'administer',
  exam_file: 'record_exam',
} as const satisfies Record<UploadPurpose, Operation>;

const unavailable = () =>
  new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'UPLOADS_UNAVAILABLE',
    'File uploads are not available right now',
  );

/** Where every file of a pet lives; deleting the prefix deletes them all. */
const petPrefix = (petId: string) => `pets/${petId}/`;

/**
 * Pet photos and exam files. The browser uploads straight to Cloudinary with
 * a signature for one new file id under the pet, one purpose, the allowed
 * formats and no overwrite. Before a record keeps the id, `verify` reads the
 * stored file back and checks its owner pet, format and size (Cloudinary
 * cannot cap the size of a signed upload). Files are `authenticated`: photos
 * are shown through signed thumbnails, exam files only through links that
 * expire in minutes and are issued after authorizing the pet.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly cloudinary: CloudinaryCredentials | null;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {
    this.cloudinary = parseCloudinaryUrl(
      config.get('CLOUDINARY_URL', { infer: true }),
    );
  }

  private get credentials(): CloudinaryCredentials {
    if (!this.cloudinary) throw unavailable();
    return this.cloudinary;
  }

  async createUpload(
    user: TokenPayload,
    petId: string,
    data: CreateUpload,
  ): Promise<UploadTicket> {
    const { pet } = await this.permissions.authorize(
      user,
      petId,
      UPLOAD_OPERATION[data.purpose],
    );
    const limits = UPLOAD_LIMITS[data.purpose];
    if (!Object.hasOwn(limits.contentTypes, data.contentType))
      throw badRequest(
        'This file type is not allowed',
        'FILE_TYPE_NOT_ALLOWED',
      );
    if (data.size > limits.maxBytes)
      throw badRequest('The file is too large', 'FILE_TOO_LARGE');
    const c = this.credentials;

    const fileId = `${petPrefix(pet.id)}${FILE_FOLDERS[data.purpose]}/${randomUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      allowed_formats: allowedFormats(data.purpose).join(','),
      // The signature can be replayed within its hour: without this, a
      // second upload would replace the file after `verify` checked it.
      overwrite: 'false',
      public_id: fileId,
      timestamp,
      type: STORAGE_TYPE,
    };
    return {
      url: uploadUrl(c),
      fields: {
        ...Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ),
        api_key: c.apiKey,
        signature: signParams(params, c.apiSecret),
      },
      fileId,
      maxBytes: limits.maxBytes,
      expiresAt: new Date((timestamp + UPLOAD_WINDOW_S) * 1000).toISOString(),
    };
  }

  /**
   * Checks an uploaded file before a record keeps it: it must have been
   * issued for this pet and purpose, exist, and be within the purpose's
   * formats and size. A file that breaks a limit is deleted. Call it only
   * after authorizing the pet. Returns the detected format.
   */
  async verify(
    petId: string,
    purpose: UploadPurpose,
    fileId: string,
  ): Promise<{ format: string }> {
    if (!fileId.startsWith(`${petPrefix(petId)}${FILE_FOLDERS[purpose]}/`))
      throw badRequest(
        'The file was not uploaded for this pet',
        'FILE_NOT_UPLOADED',
      );
    const c = this.credentials;
    const res = await fetch(`${resourcesUrl(c)}/${fileId}`, {
      headers: { Authorization: basicAuth(c) },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (res?.status === 404)
      throw badRequest('The file was not uploaded', 'FILE_NOT_UPLOADED');
    const body = res?.ok
      ? ((await res.json().catch(() => null)) as {
          bytes?: unknown;
          format?: unknown;
        } | null)
      : null;
    if (
      !body ||
      typeof body.bytes !== 'number' ||
      typeof body.format !== 'string'
    ) {
      this.logger.warn(
        `Cloudinary lookup failed: ${res?.status ?? 'no answer'}`,
      );
      throw unavailable();
    }
    const limits = UPLOAD_LIMITS[purpose];
    const tooLarge = body.bytes > limits.maxBytes;
    if (tooLarge || !allowedFormats(purpose).includes(body.format)) {
      await this.delete([fileId]);
      throw tooLarge
        ? badRequest('The file is too large', 'FILE_TOO_LARGE')
        : badRequest('This file type is not allowed', 'FILE_TYPE_NOT_ALLOWED');
    }
    return { format: body.format };
  }

  /** Photo to show: a signed thumbnail of the upload, else the old link. */
  photoUrl(pet: Pick<PetRow, 'photoId' | 'photoUrl'>): string | null {
    if (!pet.photoId) return pet.photoUrl;
    return this.cloudinary
      ? signedImageUrl(
          this.cloudinary,
          pet.photoId,
          PHOTO_TRANSFORMATION,
          'jpg',
        )
      : null;
  }

  /** A link to an exam's file that expires in minutes; read access required. */
  async examFileLink(
    user: TokenPayload,
    petId: string,
    examId: string,
  ): Promise<FileLink> {
    const { pet } = await this.permissions.authorize(user, petId, 'read');
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, petId: pet.id },
    });
    if (!exam?.fileId || !exam.fileFormat) throw notFound('File not found');
    const c = this.credentials;
    const now = Math.floor(Date.now() / 1000);
    return {
      url: privateDownloadUrl(
        c,
        exam.fileId,
        exam.fileFormat,
        now + READ_LINK_S,
        now,
      ),
      expiresAt: new Date((now + READ_LINK_S) * 1000).toISOString(),
    };
  }

  /** Deletes files by id. Best effort: a failure is logged, never thrown. */
  async delete(fileIds: string[]): Promise<void> {
    if (!fileIds.length || !this.cloudinary) return;
    const query = new URLSearchParams({ invalidate: 'true' });
    for (const id of fileIds) query.append('public_ids[]', id);
    await this.adminDelete(query);
  }

  /** Deletes every file of these pets (after the pets were deleted). Best effort. */
  async deletePetFiles(petIds: string[]): Promise<void> {
    if (!this.cloudinary) return;
    for (const petId of petIds) {
      const query = new URLSearchParams({
        prefix: petPrefix(petId),
        invalidate: 'true',
      });
      // Each call deletes up to 1000 files and says `partial` if more remain.
      for (let round = 0; round < 10; round++) {
        if (!(await this.adminDelete(query))?.partial) break;
      }
    }
  }

  private async adminDelete(
    query: URLSearchParams,
  ): Promise<{ partial?: boolean } | null> {
    const c = this.credentials;
    try {
      const res = await fetch(`${resourcesUrl(c)}?${query.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: basicAuth(c) },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return (await res.json()) as { partial?: boolean };
    } catch (error) {
      // Leftover files sit under pets/<petId>/ with no record pointing at them.
      this.logger.error(`Cloudinary delete failed: ${String(error)}`);
      return null;
    }
  }
}
