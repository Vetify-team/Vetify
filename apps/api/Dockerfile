# Vetify API image. Multi-stage: the build stage has devDependencies; the
# runtime keeps only production dependencies and the generated Prisma client,
# and runs as the unprivileged `node` user.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------- Dependencies ----------
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

# ---------- Runtime ----------
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/packages/types/package.json packages/types/
COPY --from=build /app/packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --prod --filter @vetify/api... --filter .

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/
COPY --from=build /app/packages/types/dist packages/types/dist

# Render injects PORT; the API reads it from the environment.
EXPOSE 3001
WORKDIR /app/apps/api
# Never run as root: a compromise of the process must not own the container.
RUN chown -R node:node /app
USER node
CMD ["node", "dist/main.js"]
