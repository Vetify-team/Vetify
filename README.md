# Vetify 🐾

**Expediente clínico compartido para mascotas.** Aplicación móvil + web (PWA) donde el
expediente pertenece al dueño y lo acompaña toda la vida, sin importar cuántas clínicas lo
atiendan.

Proyecto del curso **EIF409 Aplicaciones Informáticas Globales** — UNA, Sede Brunca, 2026.
Equipo: Francisco Mora Cabezas · Alejandro León Marín.

## Stack

Monorepo **Turborepo + pnpm**. Frontend **Next.js 16** (PWA con Serwist) + TypeScript + Tailwind

- shadcn/ui → Vercel. API **NestJS 12** + **Prisma 7** + **PostgreSQL (Neon)**, auth JWT con
  argon2 → **Docker** en **Render**. DevOps: Docker, **Husky**, **GitHub Actions**.
  Ver [`docs/PLAN_DESARROLLO.md`](./docs/PLAN_DESARROLLO.md)
  para el plan y [`docs/`](./docs) para arquitectura, modelo de datos, requerimientos, historias de
  usuario y especificación de interfaz.

## Estructura

```
apps/web        Next.js (PWA)          apps/api        NestJS + Prisma
apps/mobile     reservada (Expo)       packages/types  contratos Zod compartidos
packages/config configuración común    supabase/       modelo de datos de referencia
```

## Documentos de los avances

- [`docs/AVANCE_2.md`](./docs/AVANCE_2.md) — II Avance: propuesta, distribución, modelo de
  ingresos, situaciones del desarrollo y avance.

### I Avance

- `Vetify_Avance1.docx` — documento del avance (BMC, propuesta de desarrollo, mockups).
- `Vetify_Presentacion.html` — presentación para clase.

## Puesta en marcha

```bash
pnpm install          # sin pnpm global: corepack pnpm install. Con npm no funciona.

cp apps/web/.env.example apps/web/.env    # URL del API y llaves VAPID
cp apps/api/.env.example apps/api/.env    # DATABASE_URL de Neon y secretos JWT

# Base local, si no querés usar Neon todavía
docker compose up -d db

pnpm --filter @vetify/api exec prisma migrate dev --name inicial
pnpm dev                                  # levanta web (:3000) y api (:3001)
```

Swagger del API: `http://localhost:3001/api/docs`.

Verificación completa: `pnpm turbo run lint typecheck test build`.
