# Migración a monorepo — Vetify

> Runbook para Claude Code (VS Code). Ejecutar en orden, desde la raíz del repo `Vetify/`.
> Este documento es la fuente de verdad del refactor. Al terminar, actualizar `CLAUDE.md` y borrar
> los supuestos viejos que queden en la documentación.

## Objetivo

Pasar de "un Next.js en la raíz + un `api/` planeado" a un **monorepo Turborepo + pnpm** con:

```
apps/web        Next.js 16 (App Router) — PWA con Serwist
apps/api        NestJS + Prisma + PostgreSQL (Neon)
apps/mobile     (reservada, vacía por ahora — Expo, solo si se exige app nativa)
packages/types  Contratos compartidos (Zod + tipos)
packages/config Configuración compartida (eslint, tsconfig, prettier)
```

Decisiones ya tomadas que este refactor implementa:

- **pnpm** reemplaza a npm (borrar `package-lock.json`).
- **Serwist** reemplaza a `next-pwa` (que ya no se mantiene al día con Next.js).
- **argon2** en vez de bcrypt para hash de contraseñas.
- **Neon** como PostgreSQL gestionado. **Se elimina toda dependencia de Supabase** del frontend:
  el auth y los datos pasan por el API NestJS, no por un cliente de Supabase en el navegador.
- `supabase/schema.sql` **no se borra**: queda como modelo de datos de referencia y es la base
  para traducir a `apps/api/prisma/schema.prisma`.

---

## Paso 0 — Preflight

```bash
git status                  # el árbol debe estar limpio antes de empezar
git checkout -b refactor/monorepo
node -v                     # Node 20 o superior
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

No continuar si `git status` muestra cambios sin commitear.

## Paso 1 — Mover el frontend actual a `apps/web/`

Usar `git mv` para lo versionado (conserva historial) y `mv` normal para lo ignorado.

```bash
mkdir -p apps/web

# Archivos versionados del Next.js actual
git mv src public package.json next.config.ts postcss.config.mjs \
       tsconfig.json next-env.d.ts eslint.config.mjs apps/web/

# Archivos no versionados / ignorados
mv .env apps/web/.env 2>/dev/null || true
mv .env.example apps/web/.env.example 2>/dev/null || true

# Artefactos que se regeneran — se eliminan
rm -rf node_modules .next tsconfig.tsbuildinfo
git rm --cached package-lock.json 2>/dev/null || true
rm -f package-lock.json
```

**No mover** `docs/`, `supabase/`, `CLAUDE.md`, `README.md` ni `.gitignore`: se quedan en la raíz.

## Paso 2 — Archivos raíz del workspace

Crear `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Crear `turbo.json` con tareas `build`, `dev`, `lint`, `typecheck` y `test`. `build` depende de
`^build`, declara `outputs` (`.next/**` sin `.next/cache/**`, y `dist/**` para el API), y `dev`
va con `cache: false` y `persistent: true`.

Crear el `package.json` raíz (privado, sin dependencias de aplicación):

```json
{
  "name": "vetify",
  "private": true,
  "packageManager": "pnpm@latest",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "prepare": "husky"
  },
  "devDependencies": {
    "turbo": "latest",
    "prettier": "latest",
    "husky": "latest",
    "lint-staged": "latest"
  }
}
```

Actualizar `.gitignore` de la raíz para cubrir todo el monorepo: `node_modules/`, `.next/`,
`dist/`, `.turbo/`, `*.tsbuildinfo`, `.env`, `.env.local`.

## Paso 3 — `packages/config` y `packages/types`

`packages/config/` — paquete privado `@vetify/config` que exporta `tsconfig.base.json`,
un preset de ESLint y la configuración de Prettier. `apps/web` y `apps/api` extienden de aquí.

`packages/types/` — paquete privado `@vetify/types`, TypeScript + **Zod** como dependencia.
Estructura inicial:

```
packages/types/src/
  usuario.ts       # rol: 'dueño' | 'clinica'
  mascota.ts
  expediente.ts    # consultas, vacunas, desparasitaciones, exámenes, peso
  permisos.ts
  index.ts
```

Patrón obligatorio en cada archivo: definir el **esquema Zod** y derivar el tipo con
`z.infer`. El API valida con el esquema; el frontend tipa con el tipo. Nunca se duplica una
interfaz entre apps.

## Paso 4 — Crear `apps/api` (NestJS)

```bash
cd apps
pnpm dlx @nestjs/cli new api --package-manager pnpm --skip-git --skip-install
cd api
```

Dependencias:

```bash
pnpm add @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt \
         @nestjs/swagger @nestjs/throttler nestjs-pino pino pino-http \
         @prisma/client argon2 zod @vetify/types@workspace:*
pnpm add -D prisma @types/passport-jwt
pnpm exec prisma init
```

Módulos a crear dentro de `apps/api/src/`: `auth`, `usuarios`, `mascotas`, `expediente`,
`permisos`, `clinicas`, `ia`, y `common/` con `guards/` (rol dueño/clínica), `interceptors/`
(bitácora automática de accesos) y `filters/`.

En `main.ts`: Swagger, `ThrottlerModule` (estricto en login, registro y verificación de QR),
logger de pino, y `ValidationPipe` basado en los esquemas Zod de `@vetify/types`.

**No implementar la lógica de los módulos en este refactor.** Este paso deja el esqueleto
compilando; los módulos se construyen después siguiendo el procedimiento de módulo del API.

## Paso 5 — Prisma y base de datos

1. Traducir `supabase/schema.sql` a `apps/api/prisma/schema.prisma`, **manteniendo los nombres de
   tablas y columnas en español** (`mascotas`, `fecha_aplicacion`, `bitacora_accesos`, …).
2. Incluir todas las entidades del modelo: `usuarios`, `clinicas`, `clinica_personal`, `mascotas`,
   `consultas`, `vacunas`, `desparasitaciones`, `tratamientos`, `examenes`, `registros_peso`,
   `registros_alimentacion`, `esquemas_vacunacion`, `permisos`, `bitacora_accesos`,
   `recordatorios`, `anomalias`.
3. `DATABASE_URL` en `apps/api/.env` apuntando a Neon. Documentar la variable en
   `apps/api/.env.example` (sin credenciales reales).
4. `pnpm exec prisma migrate dev --name inicial` y `pnpm exec prisma generate`.

## Paso 6 — Limpiar y reconfigurar `apps/web`

```bash
cd apps/web
pnpm remove @supabase/ssr @supabase/supabase-js next-pwa
rm -rf src/lib/supabase
pnpm add @serwist/next serwist @vetify/types@workspace:*
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input badge tabs avatar switch progress dialog skeleton
```

Además:

- Configurar Serwist en `next.config.ts` y crear `src/sw.ts` + `src/app/manifest.ts`.
- Crear `src/lib/api-client.ts`: cliente HTTP tipado contra el API, con manejo de access token y
  refresh token. **Ningún componente hace `fetch` crudo.**
- Crear `src/hooks/` para los hooks de TanStack Query. Regla: estos hooks **no importan nada de
  `next/*`**, para poder reutilizarse tal cual si algún día se agrega `apps/mobile`.
- Reorganizar `src/app/` en los grupos de rutas: `(auth)`, `(dueno)`, `(clinica)` y la ruta
  pública `verificar/[token]`.

## Paso 7 — `apps/mobile` (reservada)

Crear solo `apps/mobile/.gitkeep` y un `README.md` de una línea explicando que la carpeta está
reservada para la app Expo en caso de que se requiera aplicación nativa, y que reutilizaría
`@vetify/types` y los hooks de `apps/web/src/hooks`. **No inicializar Expo todavía.**

## Paso 8 — Calidad y CI/CD

- **Husky + lint-staged** en la raíz: hook `pre-commit` que corre lint y format sobre lo staged.
- `.github/workflows/ci.yml`: en cada PR, `pnpm install --frozen-lockfile` y
  `pnpm turbo run lint typecheck test build`, aprovechando el filtrado por paquetes afectados.
- `.github/workflows/deploy.yml`: despliegue solo si CI pasó en `main` — `apps/web` a Vercel
  (root directory `apps/web`) y `apps/api` a Render vía imagen Docker.
- `apps/api/Dockerfile` multi-stage (build con devDependencies, runtime solo con producción y
  el cliente de Prisma generado).
- `docker-compose.yml` en la raíz con PostgreSQL local + el API, para desarrollo sin depender
  de Neon.

## Paso 9 — Documentación

- Reescribir `CLAUDE.md`: estructura de monorepo, stack actualizado (pnpm, Turborepo, Neon,
  Serwist, argon2, sin Supabase), comandos nuevos.
- Actualizar `docs/ARQUITECTURA.md` con el monorepo y **dejar escrito como decisión de diseño**
  que la estructura soporta web y nativo desde el mismo backend, priorizando la PWA.
- Actualizar `docs/PLAN_DESARROLLO.md` a la nueva realidad.
- Crear los tres documentos que faltan, aunque sea con estructura y secciones vacías por llenar:
  `docs/requerimientos.md` (funcionales y no funcionales), `docs/historias_usuario.md`
  (épicas e historias) y `docs/ui-spec.md` (sistema de diseño y mapeo pantalla ↔ historia,
  referenciando `docs/diseno/mockups.html`).

## Paso 10 — Verificación y cierre

```bash
cd <raíz del repo>
pnpm install
pnpm turbo run lint typecheck build
```

Todo debe pasar en verde antes de commitear. Luego:

```bash
git add -A
git commit -m "refactor: migrar a monorepo Turborepo (apps/web, apps/api, packages compartidos)"
```

### Checklist final

- [ ] `apps/web` arranca con `pnpm dev` y la PWA es instalable.
- [ ] `apps/api` compila y expone Swagger.
- [ ] No queda **ninguna** referencia a `@supabase/supabase-js` ni a `next-pwa` en el código.
- [ ] `supabase/schema.sql` y `docs/diseno/` siguen intactos.
- [ ] `pnpm-lock.yaml` está versionado; `package-lock.json` ya no existe.
- [ ] `CLAUDE.md` describe el repo tal como quedó, no como estaba antes.
