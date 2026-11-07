---
sidebar_position: 6
title: Adding an endpoint
---

# Adding an endpoint

1. Model in `schema.prisma` + migration.
2. Zod contract in `packages/types`.
3. Service that starts with `PermissionsService.authorize`.
4. Controller with `@ZodBody`, `@ZodResponse`, `@ErrorResponses` and `version: '1'`.
5. Tests, including the denied case (`403`).
6. Client call in `apps/web/src/lib/api-client.ts` and a hook; regenerate the OpenAPI with
   `corepack pnpm --filter @vetify/api openapi`.
