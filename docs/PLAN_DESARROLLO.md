# Plan de desarrollo — Vetify

> Qué construir y en qué orden. El II Avance necesita **autenticación**, **expediente** y
> **esquema de vacunación** funcionando, con las pantallas reales en código.

## Estado del repositorio

La migración a **monorepo Turborepo + pnpm** ya está hecha. Lo que existe hoy:

| Pieza                           | Estado                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`                      | Next.js 16 sin Supabase, PWA con Serwist, shadcn/ui, `api-client.ts` tipado, rutas agrupadas en `(auth)`, `(dueno)`, `(clinica)` y `verificar/[token]` con pantallas de marcador. Compila. |
| `apps/api`                      | Esqueleto de NestJS: los siete módulos vacíos, `common/` con guards, interceptor de bitácora, filtro y pipe de Zod. Swagger en `/api/docs`. Compila y arranca.                             |
| `packages/types`                | Contratos completos en Zod para usuarios, clínicas, mascotas, expediente, permisos, carné e IA.                                                                                            |
| `packages/config`               | tsconfig base, preset de ESLint y Prettier compartidos.                                                                                                                                    |
| `apps/api/prisma/schema.prisma` | Las 16 entidades, nombres en español. **Validado pero sin migración aplicada.**                                                                                                            |
| CI/CD                           | GitHub Actions (lint, typecheck, test, build) y deploy a Vercel/Render. Dockerfile y docker-compose.                                                                                       |
| `supabase/schema.sql`           | Se conserva como modelo de referencia.                                                                                                                                                     |
| `docs/diseno/mockups.html`      | Referencia visual obligatoria de cada pantalla.                                                                                                                                            |

---

## Avance al 7 oct 2026

Fases 0 a 2 y 4 hechas en local (salvo push), y la mayor parte de la 3 (permisos y bitácora; falta
el carné QR). Detalle y evidencia en [`AVANCE_2.md`](./AVANCE_2.md).

## Fase 0 — Base de datos (bloquea todo lo demás)

1. Crear el proyecto en **Neon** y copiar el connection string.
2. `apps/api/.env` con `DATABASE_URL` (ver `apps/api/.env.example`).
3. `pnpm --filter @vetify/api exec prisma migrate dev --name inicial`.
4. `pnpm --filter @vetify/api exec prisma generate`.

Alternativa sin Neon, para desarrollo local: `docker compose up -d db` y
`DATABASE_URL=postgresql://vetify:vetify@localhost:5432/vetify`.

## Fase 1 — Autenticación (`apps/api/src/auth`)

Registro, login, refresco rotado y cierre de sesión. Hash con **argon2**. Access token corto y
refresh token guardado hasheado en `sesiones_refresco`. Guard JWT global con `@Publico()` para
las rutas abiertas, y `@Roles()` para separar `dueño` de `clinica`. Throttling estricto en login
y registro. Los contratos (`registrarUsuarioSchema`, `iniciarSesionSchema`, `sesionSchema`) ya
están en `@vetify/types`.

## Fase 2 — Mascotas y expediente

`mascotas`: CRUD del dueño. `expediente`: consultas, vacunas, desparasitaciones, tratamientos,
exámenes, peso y alimentación. Regla que no se negocia: el acto médico lo escribe la clínica con
permiso activo; el día a día lo escribe el dueño; ambos leen. Cada acceso pasa por el
interceptor de bitácora.

## Fase 3 — Permisos y carné QR

`permisos`: otorgar y **revocar en un toque**. `alcance` distingue expediente completo de
`solo_carne`. La ruta pública `/verificar/[token]` expone **solo vigencia de vacunas**, con un
token firmado por el API — nunca armado en el cliente.

## Fase 4 — Esquema de vacunación y recordatorios

Cálculo de vigencias por país + especie + edad a partir de `esquemas_vacunacion`, y generación
de recordatorios. Web Push con VAPID.

## Fase 5 — Pantallas

Replicar `docs/diseno/mockups.html`. Orden sugerido: login
y registro → mis mascotas → expediente → permisos → carné QR → portal de clínica.

## Fase 6 — Analítica e IA

Curva de peso vs. rango esperado con Recharts marcando anomalías, frecuencia y motivo de
consultas, adherencia. Módulo `ia`: anomalías de peso, clasificación de motivo, resumen previo.

## Fase 7 — Cierre

Exportación a PDF, integración con calendario (ICS), manuales y defensa.

---

## Procedimiento para cada pieza

1. **Modelo** primero: `schema.prisma` + migración + actualizar `docs/MODELO_DATOS.md`.
2. **Contrato** después: esquema Zod en `packages/types`.
3. **Módulo del API**: controlador sin lógica, servicio con la lógica y **toda** la autorización.
4. **Pruebas**, incluyendo el caso denegado (clínica sin permiso → `403`).
5. **Pantalla**: hook de TanStack Query, componente shadcn, estados de carga/error/vacío/offline.
6. `pnpm turbo run lint typecheck test build` en verde antes de commitear.
