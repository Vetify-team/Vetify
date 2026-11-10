import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config.js';
import type { MailService } from '../mail/mail.service.js';
import { reminderEmail, reminderLine } from '../mail/templates.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { VaccinationStatusService } from '../records/vaccination-status.service.js';
import { NotificationsService } from './notifications.service.js';

const base = {
  name: 'Ana <b>',
  petName: 'Luna',
  date: '10 de noviembre',
  link: 'https://app.vetify.live/mascotas/p1/vacunas',
};

describe('reminder email', () => {
  it('says what is due and when', () => {
    expect(
      reminderLine({
        ...base,
        kind: 'vaccination',
        subject: 'Rabia',
        offsetDays: 0,
      }),
    ).toBe('La vacuna Rabia de Luna corresponde hoy, 10 de noviembre.');
    expect(
      reminderLine({
        ...base,
        kind: 'deworming',
        subject: 'internal',
        offsetDays: 7,
      }),
    ).toBe(
      'La desparasitación interna de Luna corresponde el 10 de noviembre, en 7 días.',
    );
    expect(
      reminderLine({
        ...base,
        kind: 'weight',
        subject: 'bajó 2 kg (10 %)',
        offsetDays: 0,
      }),
    ).toBe(
      'El peso de Luna bajó 2 kg (10 %) en el registro del 10 de noviembre.',
    );
  });

  it('escapes names in the HTML and drops the button without a link', () => {
    const email = reminderEmail({
      ...base,
      kind: 'vaccination',
      subject: 'Rabia',
      offsetDays: 0,
      link: null,
    });
    expect(email.subject).toBe('Recordatorio de Luna: hoy');
    expect(email.html).toContain('Ana &lt;b&gt;');
    expect(email.html).not.toContain('<a href');
    expect(email.text).toContain('apagarlos en Ajustes');
  });
});

function setup(emailReminders: boolean) {
  const notification = {
    id: 'n1',
    petId: 'p1',
    kind: 'weight',
    subject: 'bajó 2 kg (10 %)',
    dueOn: new Date('2026-11-10T00:00:00Z'),
    offsetDays: 0,
    createdAt: new Date(),
    pet: { id: 'p1', name: 'Luna' },
    user: { name: 'Ana', email: 'ana@example.test', emailReminders },
  };
  const updates: { status?: string }[] = [];
  const db = {
    emailDelivery: {
      findMany: vi.fn(async () => [{ id: 'd1', attempts: 0, notification }]),
      updateMany: vi.fn(async ({ data }: { data: { status?: string } }) => {
        updates.push(data);
        return { count: 1 };
      }),
    },
  };
  const send = vi.fn(async () => undefined);
  const settings: Partial<Env> = {
    RESEND_API_KEY: 'test',
    OWNER_APP_URL: 'https://app.vetify.live',
  };
  const service = new NotificationsService(
    db as unknown as PrismaService,
    {} as VaccinationStatusService,
    { send } as unknown as MailService,
    { get: (key: keyof Env) => settings[key] } as ConfigService<Env, true>,
  );
  const run = () =>
    (service as unknown as { deliverEmails(): Promise<void> }).deliverEmails();
  return { run, send, updates };
}

describe('email delivery', () => {
  it('sends the reminder with a link to the pet', async () => {
    const { run, send, updates } = setup(true);
    await run();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@example.test',
        subject: 'Cambio de peso de Luna',
        text: expect.stringContaining(
          'https://app.vetify.live/mascotas/p1/peso',
        ),
      }),
    );
    expect(updates.at(-1)?.status).toBe('sent');
  });

  it('skips owners who turned email reminders off', async () => {
    const { run, send, updates } = setup(false);
    await run();
    expect(send).not.toHaveBeenCalled();
    expect(updates.at(-1)?.status).toBe('skipped');
  });
});
