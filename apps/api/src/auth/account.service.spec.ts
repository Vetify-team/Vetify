import * as argon2 from 'argon2';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenPayload } from '@vetify/types';
import type { FilesService } from '../files/files.service.js';
import type { MailService } from '../mail/mail.service.js';
import { accountDeletedEmail } from '../mail/templates.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AccountService } from './account.service.js';

const PASSWORD = 'correct horse battery';
const token: TokenPayload = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'ana@example.test',
  role: 'owner',
  sid: '22222222-2222-4222-8222-222222222222',
};

describe('AccountService.delete', () => {
  let hash: string;
  let row: Record<string, unknown>;
  let current: Record<string, unknown> | null;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn(async () => current),
      delete: vi.fn().mockResolvedValue({}),
    },
    pet: { findMany: vi.fn().mockResolvedValue([{ id: 'pet-1' }]) },
  };
  const prisma = {
    user: { findUnique: vi.fn(async () => row) },
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  };
  const mail = { send: vi.fn().mockResolvedValue(undefined) };
  const files = { deletePetFiles: vi.fn().mockResolvedValue(undefined) };
  const service = new AccountService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    files as unknown as FilesService,
  );

  beforeAll(async () => {
    hash = await argon2.hash(PASSWORD);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    row = {
      id: token.sub,
      email: 'ana@example.test',
      name: 'Ana',
      role: 'owner',
      passwordHash: hash,
    };
    current = row;
  });

  it('locks the user, deletes the row and emails the confirmation', async () => {
    await service.delete(token, PASSWORD);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: token.sub } });
    expect(files.deletePetFiles).toHaveBeenCalledWith(['pet-1']);
    expect(mail.send).toHaveBeenCalledWith({
      to: 'ana@example.test',
      ...accountDeletedEmail({ name: 'Ana' }),
    });
  });

  it('rejects a wrong password without deleting or emailing', async () => {
    await expect(service.delete(token, 'wrong')).rejects.toMatchObject({
      code: 'WRONG_PASSWORD',
      status: 403,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('refuses clinic and admin accounts even with the right password', async () => {
    for (const role of ['clinic', 'admin']) {
      row = { ...row, role };
      await expect(service.delete(token, PASSWORD)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('loses to a password reset that committed after the check', async () => {
    current = { ...row, passwordHash: 'changed' };
    await expect(service.delete(token, PASSWORD)).rejects.toMatchObject({
      code: 'WRONG_PASSWORD',
    });
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(files.deletePetFiles).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('escapes the name in the confirmation email', () => {
    const email = accountDeletedEmail({ name: '<b>Ana</b>' });
    expect(email.html).not.toContain('<b>Ana</b>');
    expect(email.text).toContain('No se puede deshacer');
  });
});
