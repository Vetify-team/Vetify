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
