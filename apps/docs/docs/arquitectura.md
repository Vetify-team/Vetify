---
sidebar_position: 3
title: Arquitectura
---

# Arquitectura

Monorepo **Turborepo + pnpm**, TypeScript de punta a punta.

```text
apps/web        Next.js 16 — PWA (Serwist). App del dueño y portal de la clínica.
apps/api        NestJS 12 + Prisma 7 + PostgreSQL. Lógica de negocio y autorización.
apps/docs       Este sitio (Docusaurus) con la referencia del API (Scalar).
apps/mobile     Reservada para una app nativa con Expo.
packages/types  Contratos: esquemas Zod y tipos derivados. Fuente única de verdad.
packages/config tsconfig base, preset de ESLint y Prettier.
```

## Un contrato, tres consumidores

Cada esquema de `@vetify/types` se define una sola vez y se usa en tres lugares:

1. **El API valida** la entrada con él (`ZodValidationPipe`).
2. **La web tipa** sus llamadas y valida los formularios con las mismas reglas.
3. **La documentación** lo convierte a OpenAPI: la [referencia](pathname:///referencia) se
   genera del mismo esquema que valida, así que no puede quedar desactualizada respecto del
   código.

## Capas

| Capa     | Dónde      | Responsabilidad                                                |
| -------- | ---------- | -------------------------------------------------------------- |
| Clientes | `apps/web` | PWA del dueño y portal de la clínica. Nunca habla con la base. |
| API      | `apps/api` | REST + JWT. Toda la autorización vive en los servicios.        |
| Datos    | PostgreSQL | Neon en producción; Docker en desarrollo.                      |

En `apps/web`, `src/lib/api-client.ts` es el único punto que hace `fetch`, y los hooks de
TanStack Query de `src/hooks` no importan nada de Next: se podrían reutilizar desde una app
nativa.

## Despliegue

- **Web:** Vercel.
- **API:** contenedor Docker en Render.
- **CI:** GitHub Actions corre lint, typecheck, pruebas y build en cada push.
