---
sidebar_position: 2
title: Getting started
---

# Getting started

## Requirements

- **Node.js 20** or later.
- **pnpm**, which ships with Node through Corepack. The monorepo does not work with npm: the
  `workspace:*` protocol that links internal packages is pnpm's.
- **Docker Desktop**, for local PostgreSQL.

## Install

```bash
corepack pnpm install
```

## Database

```bash
docker compose up -d db
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

In `apps/api/.env`, generate each secret with `openssl rand -base64 48`:

```bash
DATABASE_URL="postgresql://vetify:vetify@localhost:5432/vetify"
JWT_ACCESS_SECRET="…"
JWT_REFRESH_SECRET="…"
LINK_CODE_SECRET="…"
```

Then apply the migrations (they include Costa Rica's vaccine catalog):

```bash
corepack pnpm --filter @vetify/api exec prisma migrate dev
```

## An admin, to verify clinics

Admins cannot sign up through the API. Create one on the server:

```bash
ADMIN_EMAIL=admin@vetify.test ADMIN_NAME="Vetify" ADMIN_PASSWORD="a-long-passphrase" \
  corepack pnpm --filter @vetify/api admin:create
```

## Run everything

```bash
corepack pnpm dev
```

| Piece                          | Address                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| Web (PWA)                      | http://localhost:3000 — calls the API through `/api` on the same origin |
| API                            | http://localhost:3001/api/v1                                            |
| Interactive reference (Scalar) | http://localhost:3001/api/docs                                          |
| OpenAPI JSON                   | http://localhost:3001/api/docs-json                                     |
| This site                      | http://localhost:3002                                                   |

To browse the database: `corepack pnpm --filter @vetify/api exec prisma studio`.

## Full verification

```bash
corepack pnpm turbo run lint typecheck test build --concurrency=1
```

For adversarial API E2E tests, create and migrate a separate local `vetify_security_*`
database, set `SECURITY_TEST_DATABASE_URL`, and run `pnpm --filter @vetify/api test:e2e`.
The suite starts its own API and never targets the running development server. See
`apps/api/test/README.md` in the repository for setup and the two known-gap TODO assertions
(missing idempotency and MFA). Strict mode turns those known gaps into failing tests.
