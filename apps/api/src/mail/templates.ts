import type { Email } from './mail.service.js';

/** Names are user input: escaped before they reach the HTML. */
export const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

const layout = (body: string): string => `<!doctype html>
<html lang="es">
<body style="margin:0;background:#f4efe6;font-family:Georgia,'Times New Roman',serif;color:#1d1b18">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="margin:0 0 32px;font-size:32px">Vetify</p>
    ${body}
    <p style="margin:40px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6a645a">
      Vetify · Expediente clínico compartido de mascotas · Costa Rica
    </p>
  </div>
</body>
</html>`;

const paragraph = (text: string): string =>
  `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${text}</p>`;

export function passwordResetEmail(input: {
  name: string;
  link: string;
  minutes: number;
}): Omit<Email, 'to'> {
  const name = escapeHtml(input.name);
  return {
    subject: 'Restablecé tu contraseña de Vetify',
    html: layout(`
    ${paragraph(`Hola ${name}:`)}
    ${paragraph('Recibimos una solicitud para cambiar la contraseña de tu cuenta. Tocá el botón para elegir una nueva.')}
    <p style="margin:24px 0">
      <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#8a5c14;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px">Cambiar mi contraseña</a>
    </p>
    ${paragraph(`El enlace vence en ${input.minutes} minutos y sirve una sola vez.`)}
    ${paragraph('Si no fuiste vos, ignorá este correo: tu contraseña no cambia.')}`),
    text: [
      `Hola ${input.name}:`,
      '',
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta de Vetify.',
      'Abrí este enlace para elegir una nueva:',
      input.link,
      '',
      `El enlace vence en ${input.minutes} minutos y sirve una sola vez.`,
      'Si no fuiste vos, ignorá este correo: tu contraseña no cambia.',
    ].join('\n'),
  };
}

export function passwordChangedEmail(input: {
  name: string;
}): Omit<Email, 'to'> {
  const name = escapeHtml(input.name);
  return {
    subject: 'Tu contraseña de Vetify cambió',
    html: layout(`
    ${paragraph(`Hola ${name}:`)}
    ${paragraph('La contraseña de tu cuenta se cambió y cerramos la sesión en todos tus dispositivos.')}
    ${paragraph('Si no fuiste vos, escribinos de inmediato a <a href="mailto:contacto@vetify.live" style="color:#8a5c14">contacto@vetify.live</a>.')}`),
    text: [
      `Hola ${input.name}:`,
      '',
      'La contraseña de tu cuenta de Vetify se cambió y cerramos la sesión en todos tus dispositivos.',
      'Si no fuiste vos, escribinos de inmediato a contacto@vetify.live.',
    ].join('\n'),
  };
}

export function accountDeletedEmail(input: {
  name: string;
}): Omit<Email, 'to'> {
  const name = escapeHtml(input.name);
  return {
    subject: 'Tu cuenta de Vetify se cerró',
    html: layout(`
    ${paragraph(`Hola ${name}:`)}
    ${paragraph('Cerraste tu cuenta de Vetify. Borramos tus mascotas, sus expedientes, los permisos que habías dado a clínicas, tus avisos y tus pagos, y cerramos la sesión en todos tus dispositivos.')}
    ${paragraph('No se puede deshacer. Si querés volver, podés crear una cuenta nueva cuando quieras.')}
    ${paragraph('Si no fuiste vos, escribinos de inmediato a <a href="mailto:contacto@vetify.live" style="color:#8a5c14">contacto@vetify.live</a>.')}`),
    text: [
      `Hola ${input.name}:`,
      '',
      'Cerraste tu cuenta de Vetify. Borramos tus mascotas, sus expedientes, los permisos que habías dado a clínicas, tus avisos y tus pagos, y cerramos la sesión en todos tus dispositivos.',
      'No se puede deshacer. Si querés volver, podés crear una cuenta nueva cuando quieras.',
      'Si no fuiste vos, escribinos de inmediato a contacto@vetify.live.',
    ].join('\n'),
  };
}

export interface ReminderInput {
  name: string;
  petName: string;
  kind: string;
  /** Vaccine, deworming kind, or the weight change ("bajó 2 kg (10 %)"). */
  subject: string;
  /** Formatted date: due date, or the weight entry's date. */
  date: string;
  offsetDays: number;
  /** Where the owner sees it, or null when the app URL is not configured. */
  link: string | null;
}

const DEWORMING: Record<string, string> = {
  internal: 'desparasitación interna',
  external: 'desparasitación externa',
  deworming: 'desparasitación',
};

/** What the reminder says, in one sentence, without HTML. */
export function reminderLine(input: ReminderInput): string {
  if (input.kind === 'weight')
    return `El peso de ${input.petName} ${input.subject} en el registro del ${input.date}.`;
  const what =
    input.kind === 'deworming'
      ? `La ${DEWORMING[input.subject] ?? `desparasitación (${input.subject})`}`
      : `La vacuna ${input.subject}`;
  return input.offsetDays === 0
    ? `${what} de ${input.petName} corresponde hoy, ${input.date}.`
    : `${what} de ${input.petName} corresponde el ${input.date}, en ${input.offsetDays} días.`;
}

export function reminderEmail(input: ReminderInput): Omit<Email, 'to'> {
  const line = reminderLine(input);
  const subject =
    input.kind === 'weight'
      ? `Cambio de peso de ${input.petName}`
      : `Recordatorio de ${input.petName}: ${input.offsetDays === 0 ? 'hoy' : `en ${input.offsetDays} días`}`;
  const action =
    input.kind === 'weight' ? 'Ver la serie de peso' : 'Ver el esquema';
  const optOut =
    'Recibís este correo porque tenés los recordatorios por correo activos. Podés apagarlos en Ajustes.';
  return {
    subject,
    html: layout(`
    ${paragraph(`Hola ${escapeHtml(input.name)}:`)}
    ${paragraph(escapeHtml(line))}
    ${
      input.kind === 'weight'
        ? paragraph('Si no lo esperabas, consultalo con tu veterinario.')
        : ''
    }
    ${
      input.link
        ? `<p style="margin:24px 0">
      <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#8a5c14;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px">${action}</a>
    </p>`
        : ''
    }
    <p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6a645a">${optOut}</p>`),
    text: [
      `Hola ${input.name}:`,
      '',
      line,
      ...(input.kind === 'weight'
        ? ['Si no lo esperabas, consultalo con tu veterinario.']
        : []),
      ...(input.link ? ['', `${action}: ${input.link}`] : []),
      '',
      optOut,
    ].join('\n'),
  };
}
