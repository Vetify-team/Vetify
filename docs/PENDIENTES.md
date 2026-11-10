# Pendientes de Vetify

Actualizado: 9 de noviembre de 2026 (ONVO mergeado, sin webhook). Lo que falta para tener Vetify completo en producción,
ordenado por prioridad dentro de cada sección.

- **(tú)** te toca a vos: cuentas, claves, pagos o decisiones.
- **(código)** es trabajo en el repositorio.

## 1. Publicar lo que ya está hecho

- [x] Pagos con ONVO mergeados a `dev` (PR #25).
- [ ] **(código)** Promover `dev` → `main`. Producción todavía no tiene nada de esto:
  - PDF;
  - Grafana;
  - páginas de instalar y de clínicas;
  - recuperación de contraseña;
  - términos y su aceptación;
  - instalación con un toque;
  - ONVO.
- [ ] **(código)** Confirmar que el workflow de deploy aplicó las migraciones en Neon
      producción:
  - `password_resets`;
  - `terms_acceptance`;
  - `onvo_payments`.
- [ ] **(código)** Verificar producción después del deploy:
  - `www`, `app`, `clinica` y `api` responden;
  - el correo de recuperación llega;
  - Grafana recibe datos con `deployment.environment.name=production`.

## 2. Pagos (ONVO)

- [x] ONVO configurado; el pago con tarjeta de prueba funciona.
- [x] ~~Webhook de ONVO~~: se decidió no usarlo. El plan se activa cuando el navegador vuelve
      a `/pago`.
- [x] Revisar con ONVO los pagos pendientes al abrir Ajustes o Plan. Cubre a quien paga y
      cierra la pestaña antes de volver a `/pago`.
- [ ] **(código)** Probar SINPE Móvil y un pago real en producción. ONVO no lo permite en modo
      de prueba.
- [ ] **(tú)** Definir la política de reembolsos y qué pasa al terminar el piloto de clínicas.
- [ ] **(código)** Opcional:
  - renovación automática (suscripciones de ONVO);
  - avisar por correo cuando el plan esté por vencer.
- [ ] **(código)** Quitar de la documentación y de la configuración lo que queda de Tilopay.

## 3. Funcionalidad para dueños

- [ ] **(código)** Subir fotos de la mascota y archivos de exámenes (por ejemplo con
      Cloudinary). Hoy solo se guardan enlaces.
- [ ] **(código)** Alertas de peso: avisar cuando el peso cambia bruscamente entre registros.
- [ ] **(código)** Notificaciones push en producción:
  - generar las llaves VAPID;
  - cargarlas en Render (`VAPID_*`);
  - activar `NOTIFICATIONS_WORKER_ENABLED` en una instancia.
- [ ] **(código)** Recordatorios por correo, con Resend, además del push.
- [ ] **(código)** Cerrar la cuenta y borrar los datos desde Ajustes. Los términos dicen que se
      puede pedir.
- [ ] **(código)** Corregir el PDF: en expedientes largos, la nota final queda sola en una
      página extra.

## 4. Funcionalidad para clínicas

- [ ] **(código)** Gestión de veterinarios: invitar al equipo, roles y firmar cada acto con
      quien lo hizo.
- [ ] **(código)** Flujo de alta de clínicas: el administrador genera el enlace de registro
      después del pago, como promete `/clinicas`.
- [ ] **(código)** Suspender una clínica de emergencia: hoy, al quitarle la verificación, sus
      permisos existentes siguen activos.

## 5. Correo

- [x] Zoho Mail gratis con `admin@vetify.live` y el alias `contacto@vetify.live`.
- [x] Resend verificado y enviando desde `noreply@vetify.live` (staging probado).
- [ ] **(tú)** Instalar la app Zoho Mail en el teléfono para ver `contacto@`. El plan gratis
      no se conecta a Gmail ni al Mail del iPhone.
- [ ] **(código)** Subir DMARC de `p=none` a `p=quarantine` cuando los reportes estén limpios.
- [ ] **(código)** Correo de bienvenida al registrarse.

## 6. Seguridad

- [ ] **(código)** MFA, como mínimo para administradores y clínicas (passkeys o códigos de
      autenticador).
- [ ] **(código)** Pantalla de sesiones activas: ver dispositivos y cerrar uno o todos.
- [ ] **(código)** Llevar los límites de intentos a un almacenamiento compartido (Redis) antes
      de tener más de una instancia del API.
- [ ] **(código)** Verificar en producción:
  - TLS del sitio y de la base;
  - confianza del proxy (`TRUST_PROXY_*`);
  - cookies `Secure`;
  - HSTS.
- [ ] **(código)** Programar `idempotency:prune`, la limpieza periódica.
- [ ] **(tú)** Desinstalar la app vieja de Snyk en GitHub (Settings → Applications). Deja un
      check rojo en cada PR.
- [ ] **(tú)** Cuando el compañero esté disponible, volver a exigir 1 aprobación en la regla
      "Protected main and dev".
- [ ] **(tú)** Decidir si las previews de Vercel vuelven a estar protegidas. Hoy la protección
      está apagada.

## 7. Legal

- [ ] **(tú)** Que un abogado revise `/terminos`.
- [ ] **(tú)** Agregar el nombre legal y la cédula del responsable de Vetify.
- [ ] **(código)** Pedir de nuevo la aceptación de los términos a quien ya tiene cuenta cuando
      cambie `TERMS_VERSION`. Hoy las cuentas viejas no tienen la aceptación registrada.
- [ ] **(código)** Opcional: separar la política de privacidad en su propia página.

## 8. Calidad

- [ ] **(código)** Subir la cobertura de pruebas de la web, que está cerca del 9 %.
- [ ] **(código)** Regenerar `apps/docs/static/openapi.json`
      (`pnpm --filter @vetify/api openapi`). Ya incluye recuperación de contraseña, términos y
      pagos.
- [ ] **(código)** Actualizar las GitHub Actions que avisan del fin de Node 20.
- [ ] **(código)** Probar la instalación con un toque en un Android real.
- [ ] **(código)** Actualizar `docs/ESTADO_PROYECTO.md`, que quedó en el 30 de octubre.
- [ ] **(código)** Borrar los PDF de prueba sueltos (`apps/web/c.pdf`, `apps/web/r.pdf`).

## 9. Operación y costos

- [ ] **(tú)** Grafana Cloud: la prueba vence el 21 de noviembre y pasa sola al plan gratis.
      Revisar que el volumen entre en los límites gratis.
- [ ] **(tú)** Render free apaga el API sin uso y la primera petición tarda unos 50 s. Para
      producción real conviene el plan Starter.
- [ ] **(tú)** Neon free: revisar el límite de almacenamiento y de horas de cómputo.
- [ ] **(código)** Alertas en Grafana: errores 5xx, latencia alta y API caída.
- [ ] **(tú)** Search Console: confirmar que el sitemap se lee bien y pedir la indexación de
      `www.vetify.live`.
- [ ] **(tú)** El dominio `vetify.live` renueva el 7 de noviembre de 2027 (US$54,99).

## 10. Solo si el curso lo pide

- [ ] **(código)** `apps/mobile`: app nativa (sin iniciar). La PWA ya se instala en iPhone y
      Android.
