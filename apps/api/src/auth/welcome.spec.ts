import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignUp } from '@vetify/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config.js';
import { MailService } from '../mail/mail.service.js';
import { welcomeEmail } from '../mail/templates.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TeamService } from '../clinics/team.service.js';
import { AuthService } from './auth.service.js';

describe('welcome email', () => {
  it('greets owners with a button to the app', () => {
    const email = welcomeEmail({
      role: 'owner',
      name: 'Ana <b>',
      link: 'https://app.vetify.live',
    });
    expect(email.subject).toBe('Te damos la bienvenida a Vetify');
    expect(email.html).toContain('Ana &lt;b&gt;');
    expect(email.html).not.toContain('Ana <b>');
    expect(email.html).toContain('href="https://app.vetify.live"');
    expect(email.text).toContain('Hola Ana <b>:');
    expect(email.text).toContain('Abrir Vetify: https://app.vetify.live');
    expect(email.text).toContain('expediente de tus mascotas');
  });

  it('drops the owner button without OWNER_APP_URL', () => {
    const email = welcomeEmail({ role: 'owner', name: 'Ana', link: null });
    expect(email.html).not.toContain('Abrir Vetify');
    expect(email.text).not.toContain('Abrir Vetify');
  });

  it('tells clinics about verification, escaped and without a button', () => {
    const email = welcomeEmail({
      role: 'clinic',
      name: 'Dra. Rojas',
      clinicName: 'Vet "Sol" & <Luna>',
    });
    expect(email.html).toContain('Vet &quot;Sol&quot; &amp; &lt;Luna&gt;');
    expect(email.html).not.toContain('<Luna>');
    expect(email.html).not.toContain('Abrir Vetify');
    expect(email.text).toContain('Vet "Sol" & <Luna>');
    expect(email.text).toContain('nuestro equipo la verifica');
  });
});

const settings: Partial<Env> = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'r'.repeat(32),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  OWNER_APP_URL: 'https://app.vetify.live',
};
const config = {
  get: (key: keyof Env) => settings[key],
} as unknown as ConfigService<Env, true>;

describe('AuthService.signUp welcome', () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    clinic: { create: vi.fn().mockResolvedValue({}) },
    refreshSession: { create: vi.fn().mockResolvedValue({}) },
    clinicStaff: {
      findFirst: vi.fn().mockResolvedValue({ clinic: { suspendedAt: null } }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  };
  const send = vi.fn();
  const service = new AuthService(
    prisma as unknown as PrismaService,
    new JwtService(),
    config,
    { send } as unknown as MailService,
    {} as TeamService,
  );

  const signUp = (data: Partial<SignUp> = {}) =>
    service.signUp({
      email: 'Ana@Example.test',
      name: 'Ana',
      password: 'correct horse battery',
      role: 'owner',
      acceptTerms: true,
      ...data,
    } as SignUp);

  beforeEach(() => {
    vi.clearAllMocks();
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'ana@example.test',
      name: 'Ana',
      phone: null,
      role: 'owner',
      passwordHash: 'hash',
      createdAt: new Date(),
    };
    tx.user.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...row,
        role: data.role,
        passwordHash: data.passwordHash,
      }),
    );
    tx.user.findUniqueOrThrow.mockImplementation(
      async () => tx.user.create.mock.results.at(-1)!.value,
    );
  });

  it('sends one owner welcome with the app link after the commit', async () => {
    send.mockResolvedValue(undefined);
    await signUp();
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@example.test',
        subject: 'Te damos la bienvenida a Vetify',
        text: expect.stringContaining('https://app.vetify.live'),
      }),
    );
    // Sent only once the user row exists, never from inside the transaction.
    expect(tx.user.create.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0]!,
    );
  });

  it('sends the clinic version, without a link', async () => {
    send.mockResolvedValue(undefined);
    await signUp({ role: 'clinic', clinicName: 'Vet Sol' });
    const [email] = send.mock.calls[0] as [{ text: string }];
    expect(email.text).toContain('Vet Sol');
    expect(email.text).not.toContain('https://');
  });

  it('still signs up when Resend fails or hangs', async () => {
    send.mockRejectedValueOnce(new Error('Resend answered 500'));
    await expect(signUp()).resolves.toHaveProperty('session.user');

    send.mockReturnValueOnce(new Promise(() => undefined));
    await expect(signUp()).resolves.toHaveProperty('session.user');
  });

  it('sends nothing when the email is taken', async () => {
    const { Prisma } = await import('../generated/prisma/client.js');
    tx.user.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(signUp()).rejects.toMatchObject({ status: 409 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('MailService without RESEND_API_KEY', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchSpy));
  afterEach(() => vi.unstubAllGlobals());

  it('sends nothing', async () => {
    const mail = new MailService({
      get: (key: keyof Env) =>
        ({ RESEND_API_KEY: '', NODE_ENV: 'test' })[key as string],
    } as unknown as ConfigService<Env, true>);
    await mail.send({
      to: 'ana@example.test',
      ...welcomeEmail({ role: 'owner', name: 'Ana', link: null }),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
