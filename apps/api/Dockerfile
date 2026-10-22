# Imagen del API de Vetify. Multi-stage: el build usa devDependencies y el
# runtime solo se queda con producción y el cliente de Prisma ya generado.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- Dependencias ----------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --filter @vetify/api... --filter .

# ---------- Build ----------
FROM deps AS build
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN pnpm --filter @vetify/types build \
 && pnpm --filter @vetify/api exec prisma generate \
 && pnpm --filter @vetify/api build

# ---------- Dependencias de producción ----------
FROM base AS prod-deps
ENV NODE_ENV=production
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
# Skip the development-only root Husky hook while retaining native dependency scripts.
RUN npm pkg delete scripts.prepare \
 && pnpm install --frozen-lockfile --prod --filter @vetify/api... --filter .

# ---------- Runtime ----------
# Only `node` runs here: npm, npx, corepack and the pnpm cache stay out of the
# image, along with the dependencies they bundle.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app

COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/apps/api apps/api
COPY --from=prod-deps /app/packages packages
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/
COPY --from=build /app/packages/types/dist packages/types/dist

# Render inyecta PORT; el API lo lee de las variables de entorno.
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
