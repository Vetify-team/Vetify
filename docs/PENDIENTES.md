# Pendientes de Vetify

Actualizado: 10 de noviembre de 2026. Lo que falta para completar Vetify, ordenado por
prioridad dentro de cada sección.

Vetify es un proyecto académico: no cobra dinero real ni atiende clientes reales. Los pagos
funcionan solo en el modo de prueba de ONVO, con tarjetas de prueba. Lo marcado como
_(solo con clientes reales)_ no hace falta para el curso.

- **(tú)** te toca a vos: cuentas, claves, pagos o decisiones.
- **(código)** es trabajo en el repositorio.

## 1. Publicar lo que ya está hecho

- [x] `dev` → `main` (PR #27). Producción verificada el 9 de noviembre:
  - `www`, `app`, `clinica` y `api` responden;
  - el API exige aceptar los términos;
  - funciona la recuperación de contraseña;
  - las respuestas traen `X-Request-Id`;
  - las migraciones se aplicaron.
- [x] #28: el límite de 2 mascotas solo se aplica con los pagos activos. Publicado en
      `main` con #30.
- [x] Grafana recibe datos de producción (`deployment.environment.name=production`).

## 2. Pagos (ONVO, solo modo de prueba)

- [x] ONVO configurado; el pago con tarjeta de prueba funciona en staging.
- [x] ~~Webhook de ONVO~~: se decidió no usarlo. El plan se activa cuando el navegador vuelve
      a `/pago`, o al abrir Ajustes o Plan.
- [x] Revisar con ONVO los pagos pendientes al abrir Ajustes o Plan.
- [x] Producción muestra pagos en modo de prueba, igual que staging: `vetify-api` tiene la
      clave de prueba de ONVO. Se paga con tarjetas de prueba, y el límite de 2 mascotas del
      plan gratis está activo.
- [x] Documentación de pagos al día: el código y la configuración ya no tienen Tilopay, y
      `.env.example` y el handoff describen ONVO en modo de prueba y sin webhook. Se
      conservan solo las notas históricas: pagos viejos con `provider = "tilopay"` y la
      migración ya aplicada.
- ~~Claves live, pagos reales, SINPE Móvil, reembolsos y renovación automática~~: no aplican a
  un proyecto académico.

## 3. Funcionalidad para dueños

Ordenado de lo más fácil a lo más difícil.

1. [x] **Fácil** · Notificaciones push en staging y producción. Hecho:
   - un par de llaves VAPID distinto para cada ambiente, cargado en Render;
   - `VAPID_SUBJECT=mailto:contacto@vetify.live`;
   - el worker activado con `NOTIFICATIONS_WORKER_ENABLED=true`.

   Un chequeo horario de Grafana mantiene despierto el API para que el worker corra en
   Render free.
   - [x] Aviso real probado en el teléfono el 10 de noviembre (staging): una vacuna que
         vencía ese día generó el aviso, el servicio push lo aceptó y llegó al teléfono.

2. [x] **Fácil** · Corregir el PDF: la nota final ya no queda sola en una página extra
       (PR #33). Un test lo verifica con expedientes de 1 a 80 consultas.
3. [x] **Media** · Alertas de peso: si el peso cambia 10 % o más respecto del registro
       anterior (con 90 días o menos entre ambos), el dueño recibe un aviso en Avisos y por
       push, y la página de peso lo muestra. En mascotas de menos de un año solo cuentan las
       bajas.
4. [x] **Media** · Recordatorios por correo con Resend, además del push: cada aviso
       (vacuna, desparasitación o peso) también se envía por correo. Se apaga en Ajustes.
   - [ ] **(tú)** Cargar `OWNER_APP_URL` en Render para que los correos lleven el enlace a
         la app: `https://app.stg.vetify.live` en staging y `https://app.vetify.live` en
         producción. Sin ella, el correo sale igual pero sin botón.
5. [ ] **Media-alta** · **(código)** Cerrar la cuenta y borrar los datos desde Ajustes. Los
       términos dicen que se puede pedir. Hay que confirmar la identidad, borrar en cascada
       (mascotas, expediente, permisos, sesiones, pagos) y avisar por correo.
6. [ ] **Difícil** · **(código)** Subir fotos de la mascota y archivos de exámenes, por
       ejemplo con Cloudinary. Hoy solo se guardan enlaces. Hace falta otro servicio, subida
       segura con firma, límites de tamaño y tipo, y permisos de acceso a los archivos.

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

- [ ] **(tú)** Aclarar en `/terminos` que Vetify es un proyecto académico, sin cobros reales.
- [ ] _(solo con clientes reales)_ Revisión de un abogado, y el nombre legal y la cédula del
      responsable.
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
- [x] Borrar los PDF de prueba sueltos (`apps/web/c.pdf`, `apps/web/r.pdf`).

## 9. Operación y costos

- [ ] **(tú)** Grafana Cloud: la prueba vence el 21 de noviembre y pasa sola al plan gratis.
      Revisar que el volumen entre en los límites gratis.
- [ ] **(tú)** Render free apaga el API sin uso y la primera petición tarda unos 50 s. Antes de
      una presentación, abrí la app un minuto antes para despertarlo. _(Solo con clientes
      reales: plan Starter.)_
- [ ] **(tú)** Neon free: revisar el límite de almacenamiento y de horas de cómputo.
- [x] Dashboard "Vetify API" en Grafana, con selector de ambiente, métricas, base de datos,
      llamadas salientes y logs.
- [x] Alertas en Grafana para producción, con aviso a `aleleonmarin01@gmail.com` (probado):
  - errores 5xx por encima del 5 % durante 10 minutos;
  - latencia p95 por encima de 2 s;
  - errores en los logs.
- [x] Chequeo horario de Grafana Synthetic Monitoring (sonda en Ohio, espera de 60 s) a
      `https://api.vetify.live/api/v1/health`. Despierta el API para que corra el worker de
      avisos.
- [x] Alerta "API caído": avisa si el último chequeo no respondió 200.
- [ ] **(código)** Que el API no rastree sus propios envíos de telemetría a Grafana: hoy
      aparecen como llamadas salientes y trazas de más.
- [ ] **(código)** Mandar menos datos en los logs: hoy llegan a Grafana la IP del cliente y los
      encabezados de cada request. Contraseñas, tokens y cookies ya se ocultan.
- [ ] **(tú)** Search Console: confirmar que el sitemap se lee bien y pedir la indexación de
      `www.vetify.live`.
- [ ] **(tú)** El dominio `vetify.live` renueva el 7 de noviembre de 2027 (US$54,99).

## 10. Solo si el curso lo pide

- [ ] **(código)** `apps/mobile`: app nativa (sin iniciar). La PWA ya se instala en iPhone y
      Android.
