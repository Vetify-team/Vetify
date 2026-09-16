# Arquitectura e infraestructura — Vetify

Infraestructura 100 % en la nube, en cuatro capas, con DevOps y seguridad como ejes
transversales. El código vive en un **monorepo Turborepo + pnpm**.

## Decisión de diseño: un backend, varios clientes

La estructura separa deliberadamente el **dominio** (`packages/types`), la **lógica y la
autorización** (`apps/api`) y la **presentación** (`apps/web`). Consecuencia: el mismo backend
sirve tanto a la PWA como a una app nativa, sin duplicar contratos ni reglas de negocio.

**Se prioriza la PWA.** Una sola base de código cubre móvil y web, es instalable y funciona
offline, que es lo que el producto necesita. `apps/mobile` queda reservada por si el curso exige
una aplicación nativa; reutilizaría `@vetify/types` y los hooks de `apps/web/src/hooks`, que por
eso no importan nada de `next/*`.

## Estructura del monorepo

```
apps/web        Next.js 16 (App Router) — PWA con Serwist. App del dueño y portal de clínica.
apps/api        NestJS 12 + Prisma 7 + PostgreSQL. Toda la lógica de negocio y la autorización.
apps/mobile     Reservada (Expo). Vacía por ahora.
packages/types  Contratos compartidos: esquemas Zod y tipos derivados. Fuente única de verdad.
packages/config Configuración compartida: tsconfig base, preset de ESLint y Prettier.
```

## 1. Clientes

- **App del dueño (PWA):** instalable en Android/iOS y navegador.
- **Portal web de la clínica:** agenda, expedientes, adherencia y retorno.
- **Verificador de carné (QR):** hospedajes, guarderías y aerolíneas confirman vigencia sin ver
  el expediente completo.

Acceden por **HTTPS/TLS**.

## 2. Frontend — `apps/web` (Next.js) en Vercel

- Next.js 16 (React 19 + TypeScript + Tailwind + shadcn/ui), red edge/CDN global.
- **PWA con Serwist** (`src/sw.ts`), en _configurator mode_: el service worker se compila como
  paso aparte con `serwist build`. Se abandonó `next-pwa` porque inyecta una configuración de
  webpack incompatible con Turbopack, que Next 16 usa por defecto.
- **Web Push (VAPID)** para recordatorios.
- Habla con el API por **REST/JSON** con **JWT (Bearer)**, siempre a través de
  `src/lib/api-client.ts`. Ningún componente hace `fetch` crudo y el frontend **nunca** habla
  con la base de datos.

## 3. API — `apps/api` (NestJS) en Render (contenedor Docker)

- **Auth (JWT):** Passport + **argon2**, roles `dueño` y `clinica`. Access token corto y refresh
  token rotado, guardado hasheado en `sesiones_refresco`.
- **Módulos REST:** `auth`, `usuarios`, `mascotas`, `expediente`, `permisos`, `clinicas`, `ia`.
- **Prisma 7:** acceso tipado a PostgreSQL mediante el adaptador de `pg`.
- **Módulo de IA:** anomalías de peso, clasificación de motivo y resumen previo.
- **Swagger** en `/api/docs`. **Throttling** con `@nestjs/throttler`, estricto en login, registro
  y verificación de carné. **Logs** con pino.
- **Docker:** imagen multi-stage; se valida en local con `docker-compose.yml` y se despliega en
  Render.

## 4. Datos y almacenamiento

- **PostgreSQL gestionado en Neon:** expediente, esquemas y permisos.
- **Object storage** (Cloudinary o Supabase Storage): fotos, exámenes y PDF.

> Nota: se eliminó toda dependencia de Supabase en el cliente. `supabase/schema.sql` se conserva
> como modelo de datos de referencia y es la base de `apps/api/prisma/schema.prisma`.

## DevOps (transversal)

pnpm + Turborepo · Docker (local y Render) · Husky (`pre-commit` formatea, `pre-push` verifica) ·
GitHub Actions (lint, typecheck, test, build y deploy) · Vercel (web) y Render (API).

## Seguridad y datos (transversal)

HTTPS/TLS · JWT con autorización por rol · consentimiento revocable y permisos por mascota ·
bitácora de accesos · respaldos y monitoreo.

**La autorización se aplica en el API, nunca solo en la UI.** Una clínica accede a una mascota
solo si existe un registro activo en `permisos`, y eso se verifica en el servicio. Las políticas
RLS del `schema.sql` original no se trasladaron a Prisma: esa responsabilidad pasó al API.
