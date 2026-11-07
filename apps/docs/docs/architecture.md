---
sidebar_position: 3
title: Architecture
---

# Architecture

A **Turborepo + pnpm** monorepo, TypeScript end to end.

```text
apps/web        Next.js 16 — PWA (Serwist). Owner app, clinic portal and admin portal.
apps/api        NestJS 12 + Prisma 7 + PostgreSQL. Business logic and authorization.
apps/docs       This site (Docusaurus) with the API reference (Scalar).
apps/mobile     Reserved for a native Expo app.
packages/types  Contracts: Zod schemas and derived types. The single source of truth.
packages/config Base tsconfig, ESLint preset and Prettier.
```

## One contract, three consumers

Each `@vetify/types` schema is written once and used in three places:

1. **The API validates** input with it (`ZodValidationPipe`).
2. **The web types** its calls and validates its forms with the same rules.
3. **The documentation** turns it into OpenAPI: the [reference](pathname:///referencia) is
   generated from the very schema that validates, so it cannot drift from the code.

## Layers

| Layer   | Where      | Responsibility                                                         |
| ------- | ---------- | ---------------------------------------------------------------------- |
| Clients | `apps/web` | Owner PWA, clinic portal, admin portal. Never talks to the database.   |
| Edge    | Next.js    | Serves the app with a per-request CSP and proxies `/api/*` to the API. |
| API     | `apps/api` | Versioned REST + JWT. All authorization lives in the services.         |
| Data    | PostgreSQL | Neon in production; Docker in development.                             |

The browser only ever talks to the web's own origin. Next forwards `/api/*` to the API, so
the session cookie is first-party and the Content Security Policy can keep `connect-src` at
`'self'`.

In `apps/web`, `src/lib/api-client.ts` is the only place that calls `fetch`, and the TanStack
Query hooks in `src/hooks` import nothing from Next: they could be reused from a native app.

## Deployment

- **Web:** Vercel (`API_ORIGIN` points at the API).
- **API:** Docker container on Render, running as a non-root user.
- **CI:** GitHub Actions runs lint, typecheck, tests, build and a production dependency audit.
