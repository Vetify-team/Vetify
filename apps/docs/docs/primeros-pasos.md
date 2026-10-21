---
sidebar_position: 2
title: Primeros pasos
---

# Primeros pasos

## Requisitos

- **Node.js 20** o superior.
- **pnpm**, que viene con Node a través de Corepack. El monorepo no funciona con npm: el
  protocolo `workspace:*` que enlaza los paquetes internos es propio de pnpm.
- **Docker Desktop**, para PostgreSQL local.

## Instalación

```bash
corepack pnpm install
```

## Base de datos

```bash
docker compose up -d db
cp apps/api/.env.example apps/api/.env
```

En `apps/api/.env`, para desarrollo local:

```bash
DATABASE_URL="postgresql://vetify:vetify@localhost:5432/vetify"
JWT_ACCESS_SECRET="<openssl rand -base64 48>"
JWT_REFRESH_SECRET="<openssl rand -base64 48>"
```

Después, las migraciones (incluyen el catálogo de vacunas de Costa Rica):

```bash
corepack pnpm --filter @vetify/api exec prisma migrate dev
```

## Levantar todo

```bash
corepack pnpm dev
```

| Pieza                           | Dirección                           |
| ------------------------------- | ----------------------------------- |
| Web (PWA)                       | http://localhost:3000               |
| API                             | http://localhost:3001/api           |
| Referencia interactiva (Scalar) | http://localhost:3001/api/docs      |
| OpenAPI en JSON                 | http://localhost:3001/api/docs-json |
| Este sitio                      | http://localhost:3002               |

Para ver la base: `corepack pnpm --filter @vetify/api exec prisma studio`.

## Verificación completa

```bash
corepack pnpm turbo run lint typecheck test build
```
