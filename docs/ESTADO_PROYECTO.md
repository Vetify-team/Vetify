# Estado del proyecto — Vetify

Última actualización: 30 de octubre de 2026. Punto de entrada: qué está hecho, qué falta y cómo
se trabaja. El detalle de cada tema vive en su propio documento (enlazado en cada sección).

> Mantener este archivo al día en el mismo PR que cambia el estado de algo.

## Resumen

| Rama   | Estado                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dev`  | Integración: tiene todo lo de abajo (PR #4, #6 y #9 mergeados).                                                                                  |
| `main` | **45 commits detrás de `dev`.** Falta la promoción `dev` → `main`; el deploy solo sale de `main`, así que nada de lo listado está en producción. |

No hay otras ramas activas ni PRs abiertos.

## Qué está hecho (en `dev`)

| Área                  | Estado                                                                                                                                                                                                                           | Detalle                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Monorepo              | Turborepo + pnpm: `apps/web`, `apps/api`, `apps/docs`, `packages/types`, `packages/config`. `apps/mobile` está reservada, sin inicializar.                                                                                       | [README](../README.md)                                                 |
| API (NestJS + Prisma) | 26 endpoints en `/api/v1`: auth, mascotas, expediente (consultas, vacunas, desparasitaciones, tratamientos, exámenes, peso, alimentación), permisos, clínicas y códigos de vinculación, admin, avisos, salud. Nombres en inglés. | [ARQUITECTURA](ARQUITECTURA.md), [MODELO_DATOS](MODELO_DATOS.md)       |
| Seguridad             | Sesiones con refresh rotado en cookie HttpOnly, autorización por permiso del dueño, bitácora de accesos, CSP con nonce, verificación de origen, límites de tasa, escrituras idempotentes.                                        | [SECURITY_HANDOFF](SECURITY_HANDOFF.md), [IDEMPOTENCY](IDEMPOTENCY.md) |
| Refactor              | Plan SOLID/DRY/KISS/YAGNI implementado (sesiones, idempotencia, estado de vacunación, etiquetas y errores compartidos).                                                                                                          | [REFACTOR_PLAN](REFACTOR_PLAN.md)                                      |
| Web (Next.js 16, PWA) | Dueño: mascotas, expediente, esquema, carné QR, avisos, permisos, peso, ajustes. Clínica: pacientes, vencidos, código. Admin: verificación de clínicas. Verificación pública de carné.                                           | [ui-spec](ui-spec.md)                                                  |
| Onboarding            | Registro por pasos (cuenta → primera mascota o revisión de la clínica → planes) y tour guiado al primer ingreso, repetible desde Ajustes.                                                                                        | [ONBOARDING_PLAN](ONBOARDING_PLAN.md), [prototipo](diseno/onboarding/) |
| Documentación del API | Sitio Docusaurus con referencia Scalar en `apps/docs`.                                                                                                                                                                           | `apps/docs`                                                            |
| Pruebas               | API: 61 unitarias + 12 con PostgreSQL + suite E2E adversarial. Web: 15 (lógica, sin componentes).                                                                                                                                | [SECURITY_E2E_REPORT](SECURITY_E2E_REPORT.md)                          |

## Cómo se trabaja

1. **Rama de trabajo → PR a `dev`.** `main` solo acepta PRs desde `dev` (lo valida _Branch policy_).
2. **Checks obligatorios** en `main` y `dev` (regla "Protected main and dev"): Branch policy; Lint,
   typecheck, test and build; Snyk (dependencies, code, container); SonarCloud Code Analysis;
   `security/snyk`; y **PR score**.
3. **PR score ≥ 80/100**: se calcula solo cuando pasan todos los demás checks del commit, con las
   notas de SonarCloud y la cobertura de las líneas cambiadas. Ver [PR_SCORE](PR_SCORE.md).
4. **Aprobación humana**: 1 aprobación de alguien distinto a quien hizo el último push; cada push
   descarta las aprobaciones anteriores y vuelve a correr todos los checks.
5. **La rama tiene que estar al día con `dev`** antes del merge. Al mergear, la rama se borra sola.
6. SonarCloud usa **Automatic Analysis** (sin cobertura en Sonar); Snyk corre en CI. Ver
   [CI_SECURITY_SCANNING](CI_SECURITY_SCANNING.md).

## Qué falta

### Para llegar a producción

- **Promover `dev` → `main`** (PR desde `dev`, con los mismos checks y aprobación).
- **Aplicar las migraciones** pendientes en cada base persistente antes de desplegar:
  `bounded_record_queries` (solo índices; puede bloquear escrituras un momento en tablas grandes)
  y `write_idempotency`. API y web se despliegan juntos.
- **Verificar el hosting**: TLS, TLS de la base, confianza del proxy, `ALLOWED_ORIGINS` y
  `API_ORIGIN`. Nada de esto está verificado en producción.

### Producto

- **Cobro real** de Premium y de los planes de clínica (pasarela para Costa Rica, suscripciones,
  límite de mascotas aplicado en el API). Hoy los planes son informativos.
- **Términos y Política de privacidad**, y su aceptación en el registro.
- Política de reembolsos y qué pasa al terminar el piloto de clínicas.
- `apps/mobile`: sin iniciar (solo si el curso exige app nativa).

### Seguridad (ver [SECURITY_ROADMAP](SECURITY_ROADMAP.md))

- MFA, pantalla de gestión de sesiones y límites de tasa compartidos entre instancias.

### Calidad

- **Pruebas de la web**: la cobertura total es baja (~9 %); el PR score exige cobertura solo
  sobre las líneas que cambia cada PR.
- **`apps/docs/static/openapi.json` desactualizado**: regenerarlo con
  `pnpm --filter @vetify/api openapi`.
- Acciones de GitHub en Node 20 (aviso de deprecación): actualizar sus versiones fijadas.

## Documentos por tema

| Tema                       | Documento                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Requerimientos e historias | [requerimientos](requerimientos.md), [historias_usuario](historias_usuario.md)                                        |
| Arquitectura y datos       | [ARQUITECTURA](ARQUITECTURA.md), [MODELO_DATOS](MODELO_DATOS.md)                                                      |
| Plan original y entregas   | [PLAN_DESARROLLO](PLAN_DESARROLLO.md), [AVANCE_2](AVANCE_2.md)                                                        |
| Seguridad                  | [SECURITY_HANDOFF](SECURITY_HANDOFF.md), [SECURITY_AUDIT](SECURITY_AUDIT.md), [SECURITY_ROADMAP](SECURITY_ROADMAP.md) |
| CI, escaneos y PR score    | [CI_SECURITY_SCANNING](CI_SECURITY_SCANNING.md), [PR_SCORE](PR_SCORE.md)                                              |
| Onboarding                 | [ONBOARDING_PLAN](ONBOARDING_PLAN.md)                                                                                 |
| Refactor                   | [REFACTOR_PLAN](REFACTOR_PLAN.md)                                                                                     |
