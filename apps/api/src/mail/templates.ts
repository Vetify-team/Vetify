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

const button = (
  link: string,
  label: string,
): string => `<p style="margin:24px 0">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#8a5c14;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px">${label}</a>
    </p>`;

export type WelcomeInput =
  | {
      role: 'owner';
      name: string;
      /** Owner app origin, or null when OWNER_APP_URL is not configured. */
      link: string | null;
    }
  | { role: 'clinic'; name: string; clinicName: string };

/** Sent once, after sign-up commits. Clinics get no button: there is no clinic URL. */
export function welcomeEmail(input: WelcomeInput): Omit<Email, 'to'> {
  const lines =
    input.role === 'owner'
      ? [
          'Te damos la bienvenida a Vetify. Desde ahora podés llevar el expediente de tus mascotas en un solo lugar: vacunas, desparasitaciones, peso y su carné.',
          'Cuando vayás al veterinario, compartí el expediente con la clínica usando el código que te dan. Vos decidís quién lo ve y podés quitar el permiso cuando querás.',
        ]
      : [
          `Te damos la bienvenida a Vetify. Creamos la cuenta de ${input.clinicName} y quedaste a cargo de ella.`,
          'Antes de que los dueños puedan compartir expedientes con la clínica, nuestro equipo la verifica. Mientras tanto ya podés entrar y conocer el panel.',
        ];
  const link = input.role === 'owner' ? input.link : null;
  const action = 'Abrir Vetify';
  const help =
    'Si tenés dudas, escribinos a contacto@vetify.live. Si no creaste esta cuenta, avisanos a esa misma dirección.';
  return {
    subject: 'Te damos la bienvenida a Vetify',
    html: layout(`
    ${paragraph(`Hola ${escapeHtml(input.name)}:`)}
    ${lines.map((line) => paragraph(escapeHtml(line))).join('\n    ')}
    ${link ? button(link, action) : ''}
    ${paragraph('Si tenés dudas, escribinos a <a href="mailto:contacto@vetify.live" style="color:#8a5c14">contacto@vetify.live</a>. Si no creaste esta cuenta, avisanos a esa misma dirección.')}`),
    text: [
      `Hola ${input.name}:`,
      '',
      ...lines,
      ...(link ? ['', `${action}: ${link}`] : []),
      '',
      help,
    ].join('\n'),
  };
}

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
    ${button(input.link, 'Cambiar mi contraseña')}
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
    ${input.link ? button(input.link, action) : ''}
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

const ROLE_NAMES = { admin: 'administrador', veterinarian: 'veterinario' };

/** Invitation to join a clinic's team. The link is the only way in. */
export function clinicInvitationEmail(input: {
  clinicName: string;
  inviterName: string;
  role: 'admin' | 'veterinarian';
  link: string;
  days: number;
}): Omit<Email, 'to'> {
  const role = ROLE_NAMES[input.role];
  const line = `${input.inviterName} te invitó a sumarte al equipo de ${input.clinicName} en Vetify como ${role}.`;
  const after =
    'Con el enlace creás tu cuenta con este correo. Lo que registres en los expedientes queda firmado con tu nombre.';
  const expiry = `El enlace vence en ${input.days} días y sirve una sola vez.`;
  const ignore = 'Si no esperabas esta invitación, ignorá este correo.';
  return {
    subject: `Te invitaron al equipo de ${input.clinicName} en Vetify`,
    html: layout(`
    ${paragraph('Hola:')}
    ${paragraph(escapeHtml(line))}
    ${paragraph(after)}
    ${button(input.link, 'Aceptar la invitación')}
    ${paragraph(expiry)}
    ${paragraph(ignore)}`),
    text: [
      'Hola:',
      '',
      line,
      after,
      '',
      `Aceptar la invitación: ${input.link}`,
      '',
      expiry,
      ignore,
    ].join('\n'),
  };
}

/** The link to register a clinic, after the plan was agreed and paid. */
export function clinicSignupEmail(input: {
  clinicName: string;
  link: string;
  days: number;
}): Omit<Email, 'to'> {
  const line = `Ya podés registrar ${input.clinicName} en Vetify. Con el enlace creás tu cuenta, que queda como administradora de la clínica.`;
  const after =
    'Después revisamos los datos y habilitamos la clínica para recibir expedientes. Desde la sección Equipo vas a poder invitar a tus veterinarios.';
  const expiry = `El enlace vence en ${input.days} días y sirve una sola vez.`;
  const help =
    'Si tenés dudas, escribinos a contacto@vetify.live. Si no pediste este acceso, ignorá este correo.';
  return {
    subject: `Registrá ${input.clinicName} en Vetify`,
    html: layout(`
    ${paragraph('Hola:')}
    ${paragraph(escapeHtml(line))}
    ${paragraph(after)}
    ${button(input.link, 'Registrar la clínica')}
    ${paragraph(expiry)}
    ${paragraph(help)}`),
    text: [
      'Hola:',
      '',
      line,
      after,
      '',
      `Registrar la clínica: ${input.link}`,
      '',
      expiry,
      help,
    ].join('\n'),
  };
}

/** Sent to the clinic's administrators once an admin verifies it. */
export function clinicVerifiedEmail(input: {
  name: string;
  clinicName: string;
  /** The clinic's link-code page, or null without a trusted origin. */
  link: string | null;
}): Omit<Email, 'to'> {
  const line = `Verificamos ${input.clinicName}. Desde ahora los dueños pueden compartir con la clínica el expediente de sus mascotas.`;
  const after =
    'En la consulta, generá un código de vinculación desde el portal y mostráselo al dueño: lo escribe en su app y la clínica ve el expediente mientras él lo permita.';
  const help = 'Si tenés dudas, escribinos a contacto@vetify.live.';
  const action = 'Generar un código';
  return {
    subject: `${input.clinicName} ya está verificada en Vetify`,
    html: layout(`
    ${paragraph(`Hola ${escapeHtml(input.name)}:`)}
    ${paragraph(escapeHtml(line))}
    ${paragraph(after)}
    ${input.link ? button(input.link, action) : ''}
    ${paragraph('Si tenés dudas, escribinos a <a href="mailto:contacto@vetify.live" style="color:#8a5c14">contacto@vetify.live</a>.')}`),
    text: [
      `Hola ${input.name}:`,
      '',
      line,
      after,
      ...(input.link ? ['', `${action}: ${input.link}`] : []),
      '',
      help,
    ].join('\n'),
  };
}

/** Sent to every Vetify admin when a clinic registers and waits for review. */
export function clinicPendingReviewEmail(input: {
  clinicName: string;
  email: string;
  /** The admin clinics page, or null without a trusted origin. */
  link: string | null;
}): Omit<Email, 'to'> {
  const line = `${input.clinicName} se registró con ${input.email} y espera la verificación.`;
  const after =
    'Antes de verificarla, confirmá la cédula jurídica y que la persona responsable esté colegiada. Hasta entonces la clínica no puede recibir expedientes.';
  const action = 'Revisar clínicas';
  return {
    subject: `Clínica por verificar: ${input.clinicName}`,
    html: layout(`
    ${paragraph('Hola:')}
    ${paragraph(escapeHtml(line))}
    ${paragraph(after)}
    ${input.link ? button(input.link, action) : ''}`),
    text: [
      'Hola:',
      '',
      line,
      after,
      ...(input.link ? ['', `${action}: ${input.link}`] : []),
    ].join('\n'),
  };
}
