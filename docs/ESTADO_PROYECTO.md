# Estado del proyecto — Vetify

Última actualización: 12 de noviembre de 2026. Punto de entrada: qué está hecho, qué falta y cómo
se trabaja. El detalle de cada tema vive en su propio documento (enlazado en cada sección); la
lista de tareas al día es [PENDIENTES](PENDIENTES.md).

> Mantener este archivo al día en el mismo PR que cambia el estado de algo.

## Resumen

Vetify está **en producción en `vetify.live`** desde el 7 de noviembre (primera promoción
`dev` → `main`, PR #14). Es un proyecto académico: los pagos funcionan solo en el modo de
prueba de ONVO.

| Sitio           | Producción (`main`)                          | Staging (`dev`)           |
| --------------- | -------------------------------------------- | ------------------------- |
| Landing         | `www.vetify.live` (el dominio raíz redirige) | `stg.vetify.live`         |
| Dueños          | `app.vetify.live`                            | `app.stg.vetify.live`     |
| Clínicas, admin | `clinica.vetify.live`                        | `clinica.stg.vetify.live` |
| API (Render)    | `api.vetify.live`                            | `api.stg.vetify.live`     |
| Base de datos   | Neon, rama `production`                      | Neon, rama `dev`          |

| Rama                           | Estado                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `main`                         | Última promoción: PR #57 (12 de noviembre). Tiene todo lo de León hasta el permiso de solo carné (#55, #56).    |
| `dev`                          | `main` más los manuales en `/ayuda` (#58) y el documento del proyecto (#60), sin promover todavía.              |
| `fix/configurable-rate-limits` | PR #59 abierto: límites por IP configurables para el tráfico que comparte IP detrás de Vercel. Checks en verde. |
| `feat/assistant`               | El asistente de mascotas (API, pantallas, términos). PR hacia `dev` pendiente de abrir.                         |

## Qué está hecho

### En producción

| Área                  | Estado                                                                                                                                                                                                                                                                             | Detalle                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Monorepo              | Turborepo + pnpm: `apps/web`, `apps/api`, `apps/docs`, `packages/types`, `packages/config`. `apps/mobile` está reservada, sin iniciar.                                                                                                                                             | [README](../README.md)                                                 |
| API (NestJS + Prisma) | 67 operaciones en `/api/v1`: auth, mascotas, expediente, archivos, permisos, clínicas y equipo, enlaces de registro, admin, pagos, avisos, carné público y salud.                                                                                                                  | [ARQUITECTURA](ARQUITECTURA.md), [MODELO_DATOS](MODELO_DATOS.md)       |
| Cuentas               | Registro con aceptación de términos (`TERMS_VERSION`), recuperación de contraseña por correo, correo de bienvenida, cierre de cuenta con borrado de datos y archivos.                                                                                                              | [SECURITY_HANDOFF](SECURITY_HANDOFF.md)                                |
| Dueños                | Mascotas con foto, expediente con exámenes adjuntos, esquema de vacunación de Costa Rica, carné QR, peso con alertas de cambio, PDF, permisos con bitácora, avisos push y por correo, instalación de la PWA con un toque.                                                          | [ui-spec](ui-spec.md)                                                  |
| Clínicas              | Alta solo por enlace de un solo uso que genera un admin; verificación con auditoría y aviso por correo; equipo con roles (administrador y veterinario) e invitaciones por correo; actos médicos firmados por el veterinario de la sesión; permiso de solo carné; página de carnés. | [GUIA_VERIFICACION_CLINICAS](GUIA_VERIFICACION_CLINICAS.md)            |
| Admin                 | Verificar y desverificar clínicas, enlaces de registro, suspensión de emergencia con motivo y reactivación.                                                                                                                                                                        | [SECURITY_HANDOFF](SECURITY_HANDOFF.md)                                |
| Pagos                 | ONVO en modo de prueba: Premium para dueños (límite de 2 mascotas en el plan gratis, solo con los pagos activos) y planes de clínica. Sin webhook: el pago se confirma al volver a `/pago`.                                                                                        | [SECURITY_HANDOFF](SECURITY_HANDOFF.md)                                |
| Archivos y correo     | Cloudinary (subidas firmadas, enlaces de examen de 5 minutos), Resend desde `noreply@vetify.live`, Zoho para `contacto@`.                                                                                                                                                          | [PENDIENTES](PENDIENTES.md)                                            |
| Seguridad             | Refresh rotado en cookie HttpOnly, autorización por permiso del dueño, bitácora de accesos, CSP con nonce, verificación de origen, límites de tasa, escrituras idempotentes, suspensión que cierra las sesiones.                                                                   | [SECURITY_HANDOFF](SECURITY_HANDOFF.md), [IDEMPOTENCY](IDEMPOTENCY.md) |
| Operación             | OpenTelemetry a Grafana Cloud con dashboard, alertas (5xx, latencia, errores, API caído) y un chequeo horario que mantiene despierto el API en Render free.                                                                                                                        | [SECURITY_HANDOFF](SECURITY_HANDOFF.md)                                |

### En `dev`, sin promover

- **Manuales** para dueños y clínicas en `/ayuda`, con capturas de la app real (#58).
- **Documento del proyecto** (propuesta, arquitectura y modelo de datos) (#60).

### En `feat/assistant` (PR pendiente)

- **Asistente de mascotas.** "Preguntale a Vetify" en el perfil de la mascota del dueño, y el
  asistente clínico en la ficha del paciente, para cualquier miembro del equipo de una clínica
  verificada y no suspendida.
- **Cómo responde:** usa el expediente real, leído con los permisos de quien pregunta. Los
  estados de las vacunas los calcula el código. Una emergencia del dueño recibe una respuesta
  fija, sin llamar al modelo.
- **Proveedor:** cualquier proveedor compatible con la API de OpenAI, con un respaldo opcional
  y tiempos de espera configurables.
- **Minimización y registro:** no envía datos personales del dueño ni guarda la conversación.
  El plan gratis de dueños tiene un límite mensual, que solo aplica con los pagos activos.
- **Términos:** sección "Asistente" con la versión `2026-11-12`.
- **Detalle:** [apps/docs/docs/api/assistant.md](../apps/docs/docs/api/assistant.md) y la sección
  "Assistant" de [SECURITY_HANDOFF](SECURITY_HANDOFF.md).

### Pruebas (en `feat/assistant`)

- **API:** 313 unitarias, 13 de integración con PostgreSQL y la suite E2E adversarial (68 pasan,
  0 fallan y queda 1 TODO conocido: el MFA).
- **Web:** 68 pruebas de lógica, sin componentes.

## Cómo se trabaja

1. **Rama de trabajo → PR a `dev`.** `main` solo acepta PRs desde `dev` (lo valida _Branch
   policy_). Un push a `dev` despliega staging y uno a `main` despliega producción; la
   migración de la base corre en el despliegue (`Migrate database`).
2. **Checks obligatorios** en `main` y `dev`:
   - Branch policy;
   - Lint, typecheck, test and build (incluye `pnpm audit --prod`);
   - SonarCloud Code Analysis;
   - PR score.

   Desde el 7 de noviembre Snyk ya no es obligatorio: el check `security/snyk` falla por el
   límite del plan gratis y no bloquea.

3. **PR score ≥ 80/100**: notas de SonarCloud y cobertura de las líneas cambiadas. Ver
   [PR_SCORE](PR_SCORE.md).
4. **Aprobaciones:** hoy se exigen 0. Se relajó para mergear sin un segundo revisor; volver a
   exigir 1 cuando el equipo pueda revisar.
5. **La rama tiene que estar al día con `dev`** antes del merge.

## Qué falta

### Para publicar lo que ya está hecho

- **Sitio de documentación:** el proyecto `vetify-docs` de Vercel publica `dev` en
  `docs.stg.vetify.live`. Falta el CNAME de `docs.stg` en name.com (lo da Vercel en el dominio) y,
  para producción, decidir si se publica `docs.vetify.live` desde `main`.

- **Promover `dev` → `main`:** los manuales y el documento, y después el asistente y los límites
  configurables cuando se mergeen.
- **Desplegar el asistente:**
  - aplicar las migraciones `foreign_keys_on_update_cascade` y `assistant_usage` (las corre
    `Migrate database`);
  - cargar en Render `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` y, si se usa, el respaldo
    `LLM_FALLBACK_*`.

  Sin llave, el asistente responde 503 y el resto de la app sigue igual.

- **Correo con botón en producción:** cargar `OWNER_APP_URL=https://app.vetify.live` en
  `vetify-api`.
- **Probar en staging** lo que solo se probó en local:
  - una invitación al equipo y un alta de clínica con correo real;
  - suspender y reactivar una clínica;
  - fotos y exámenes en Cloudinary, y el cierre de cuenta que borra los archivos.

### Para muchos usuarios a la vez

- **Límites por IP:** detrás de Vercel con `TRUST_PROXY_HOPS=0`, todo el tráfico comparte un
  contador por ruta.
  - El arreglo temporal es el PR #59: subir los límites por variable.
  - El definitivo sigue pendiente: que la web reenvíe la IP del cliente en un encabezado
    firmado y que el API solo confíe en ese encabezado.
- **Render free** apaga el API sin uso: la primera petición tarda unos 50 s. Antes de una
  presentación, despertarlo un minuto antes.
- **Límites en memoria:** viven en la memoria de una sola instancia. Pasar a Redis antes de
  tener más de una.

### Asistente

- **Proveedores:** probado en local con DeepSeek y con Gemini como respaldo. No está probado en
  staging ni en producción.
- **Teléfono:** probado en Edge con tamaño de iPhone, no en un iPhone real ni en la PWA
  instalada.
- **Contador de uso:** "12 de 30 mensajes gratis" solo está cubierto por pruebas; en local los
  pagos están apagados y el límite sale `null`.
- **Calidad de las respuestas:** depende del modelo. Un modelo liviano se ha equivocado con
  fechas. Las respuestas no se revisan antes de mostrarse: los términos y el pie fijo lo
  advierten.

### Legal

- **Términos actualizados:** las cuentas existentes no vuelven a aceptarlos cuando cambia
  `TERMS_VERSION`. Hoy solo se registra la aceptación al crear la cuenta.
- **Proyecto académico:** aclarar en `/terminos` que no hay cobros reales.
- **Política de privacidad:** separarla en su propia página es opcional.

### Seguridad (ver [SECURITY_ROADMAP](SECURITY_ROADMAP.md))

- MFA, como mínimo para administradores y clínicas, y una pantalla de sesiones activas.
- Verificar en producción TLS del sitio y de la base, cookies `Secure` y HSTS.
- Programar la limpieza `idempotency:prune`.
- Snyk sin cobertura de código ni de la imagen del contenedor desde que se quitó del CI.

### Calidad

- **Pruebas de la web:** solo lógica; no hay pruebas de componentes ni de punta a punta en el
  navegador dentro del CI.
- **GitHub Actions:** actualizar las que avisan del fin de Node 20.
- **Logs:** enviar menos datos a Grafana; hoy llegan la IP del cliente y los encabezados.

### Fuera de alcance (salvo que el curso lo pida)

- `apps/mobile`: la PWA ya se instala en iPhone y Android.
- Pagos reales, reembolsos y renovación automática.

## Documentos por tema

| Tema                       | Documento                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tareas al día              | [PENDIENTES](PENDIENTES.md)                                                                                                                                          |
| Documento del proyecto     | [DOCUMENTO_PROYECTO](DOCUMENTO_PROYECTO.md)                                                                                                                          |
| Requerimientos e historias | [requerimientos](requerimientos.md), [historias_usuario](historias_usuario.md)                                                                                       |
| Arquitectura y datos       | [ARQUITECTURA](ARQUITECTURA.md), [MODELO_DATOS](MODELO_DATOS.md)                                                                                                     |
| Plan original y entregas   | [PLAN_DESARROLLO](PLAN_DESARROLLO.md), [AVANCE_2](AVANCE_2.md)                                                                                                       |
| Seguridad                  | [SECURITY_HANDOFF](SECURITY_HANDOFF.md), [SECURITY_AUDIT](SECURITY_AUDIT.md), [SECURITY_ROADMAP](SECURITY_ROADMAP.md), [SECURITY_E2E_REPORT](SECURITY_E2E_REPORT.md) |
| Clínicas y staging         | [GUIA_VERIFICACION_CLINICAS](GUIA_VERIFICACION_CLINICAS.md), [VALIDACION_STAGING](VALIDACION_STAGING.md)                                                             |
| CI, escaneos y PR score    | [CI_SECURITY_SCANNING](CI_SECURITY_SCANNING.md), [PR_SCORE](PR_SCORE.md)                                                                                             |
| Onboarding                 | [ONBOARDING_PLAN](ONBOARDING_PLAN.md)                                                                                                                                |
| Refactor                   | [REFACTOR_PLAN](REFACTOR_PLAN.md)                                                                                                                                    |
