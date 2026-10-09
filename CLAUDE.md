# CLAUDE.md — Vetify

> Contexto del proyecto para Claude Code (VS Code). Léelo antes de escribir código.
> Las convenciones detalladas viven en `.claude/skills/`.

## Qué es Vetify

Aplicación **móvil + web (PWA)** de **expediente clínico compartido para mascotas**. El
expediente **pertenece al dueño** y es alimentado por dos partes: el dueño registra el día a
día (peso, alimentación, observaciones) y la clínica veterinaria registra el acto médico
(consultas, vacunas, tratamientos, exámenes). Es único, portátil y acompaña al animal toda su
vida, sin importar cuántas clínicas lo atiendan.

**Diferenciador:** los sistemas actuales pertenecen a la clínica y encierran los datos. Vetify
invierte la propiedad: el dueño posee el expediente y decide, con consentimiento revocable,
qué clínicas lo consultan.

Curso: **EIF409 Aplicaciones Informáticas Globales**, UNA, Sede Brunca, II Ciclo 2026.
Equipo: **Francisco Mora Cabezas** y **Alejandro León Marín**.

## Estructura del monorepo

**Turborepo + pnpm.** El frontend ya no vive en la raíz: se movió a `apps/web`.

```
Vetify/
  apps/web/            Next.js 16 (App Router) — PWA con Serwist. Se despliega en Vercel.
    src/app/           Rutas: (auth), (dueno), (clinica), verificar/[token], sin-conexion
    src/components/    Componentes; ui/ son los de shadcn
    src/hooks/         TanStack Query. No importan nada de next/* (reutilizables en mobile)
    src/lib/           api-client.ts — único punto que hace fetch
    src/sw.ts          Service worker (Serwist)
  apps/api/            NestJS 12 + Prisma 7. Se despliega en Render vía Docker.
    src/               auth, usuarios, mascotas, expediente, permisos, clinicas, ia, common/
    prisma/schema.prisma
    Dockerfile
  apps/mobile/         Reservada para Expo. Vacía.
  packages/types/      @vetify/types — esquemas Zod + tipos. Fuente única de contratos.
  packages/config/     @vetify/config — tsconfig base, preset ESLint, Prettier.
  supabase/schema.sql  Modelo de datos de referencia (NO se borra)
  docs/                Documentación y diseño (docs/diseno/mockups.html)
  .claude/skills/      Convenciones del proyecto
  docker-compose.yml   PostgreSQL local + API
```

## Stack

- **Lenguaje:** TypeScript de extremo a extremo.
- **Monorepo:** **pnpm** + **Turborepo**. No se usa npm ni existe `package-lock.json`.
- **Frontend:** Next.js 16 + React 19, Tailwind 4 + shadcn/ui. PWA con **Serwist**
  (no `next-pwa`), en _configurator mode_ porque Next 16 usa Turbopack.
- **Estado/datos:** TanStack Query + Zustand.
- **API:** **NestJS 12** — ESM, con **Vitest** y **oxlint** (es lo que genera el CLI actual).
- **ORM:** **Prisma 7.10.0 fijado** sobre **PostgreSQL en Neon**. La 8 es un release candidate
  con una CLI distinta: no actualizar sin discutirlo.
- **Auth:** JWT en NestJS (Passport + **argon2**, no bcrypt). Roles `dueño` y `clinica`.
- **Gráficas:** Recharts. **QR:** `qrcode`. **PDF:** jsPDF. **Push:** Web Push API (VAPID).
- **Calidad:** ESLint (web, types) / oxlint (api) + Prettier, Vitest, Husky.
- **CI/CD:** GitHub Actions. **Hosting:** Vercel (web) + Render (api).

## Comandos

```bash
# Desde la raíz
pnpm install                   # o: corepack pnpm install (npm no entiende workspace:*)
pnpm dev                       # turbo run dev — levanta web y api
pnpm turbo run lint typecheck test build   # verificación completa

# Por paquete
pnpm --filter @vetify/web dev        # Next.js en :3000
pnpm --filter @vetify/api start:dev  # NestJS en :3001, Swagger en /api/docs
pnpm --filter @vetify/types build

# Base de datos (desde apps/api)
pnpm --filter @vetify/api exec prisma migrate dev --name <descripcion>
pnpm --filter @vetify/api exec prisma generate

# PostgreSQL local, sin depender de Neon
docker compose up -d db
```

## Convenciones

Las reglas completas están en `.claude/skills/`:

- **`vetify-convenciones`** — estructura, seguridad del expediente, idioma, stack.
- **`vetify-modulo-api`** — agregar o modificar un módulo del API de punta a punta.
- **`vetify-pantalla`** — implementar una pantalla del frontend.

Lo esencial:

- **Ningún tipo de dominio se define dos veces.** Vive en `packages/types` y ambas apps lo
  importan. El patrón es esquema Zod + `z.infer`.
- **`apps/web` nunca habla con la base de datos.** Todo pasa por `src/lib/api-client.ts`.
- **La autorización se aplica en `apps/api`**, en el servicio, nunca solo en la UI.
- Una clínica accede a una mascota **solo** con un registro activo en `permisos`, y **todo acceso
  al expediente escribe en `bitacora_accesos`**.
- UI, documentación y nombres de tablas/columnas en **español**.
- Commits convencionales en español: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- **No** poner secretos en el repo: usar `.env` (ver los `.env.example` de cada app).

## Estado actual y próximos pasos

- **Hecho:** modelo de negocio, propuesta de desarrollo, modelo de datos, infraestructura y
  diseño de pantallas. **Migración a monorepo completa**: `apps/web` sin Supabase y con PWA
  Serwist, `apps/api` con el esqueleto de NestJS compilando y Swagger, `packages/types` con los
  contratos, CI/CD y Docker.
- **II Avance (9 oct 2026), hecho:** autenticación (argon2, refresh rotado), mascotas,
  expediente, permisos con bitácora y esquema de vacunación de Costa Rica, en el API y con
  pantallas funcionales. Migraciones `inicial` y `esquemas_vacunacion_cr` aplicadas en
  PostgreSQL local (Docker). Documento del avance: `docs/AVANCE_2.md`.
- **Interfaz:** pantallas del dueño y del portal clínico ya con el diseño final (claro y oscuro).
- **Pendiente:** crear la base en Neon y desplegar; carné QR y `/verificar/[token]`; push.
- **Final (13 nov 2026):** analítica + IA, manuales, defensa.

Referencia de diseño: **`docs/diseno/diseno-pwa-vetify.pdf`** (mockups finales en claro y
oscuro) y el sistema descrito en `docs/ui-spec.md`: papel / negro cálido, Cormorant Garamond +
Lora, acento dorado solo en lo accionable y estados sin color. `docs/diseno/mockups.html` es la
versión anterior (verde y crema) y ya no rige. Se implementan como componentes reales.
