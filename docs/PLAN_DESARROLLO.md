# Plan de desarrollo para Claude Code — Vetify

> Este archivo le dice a **Claude Code** (en VS Code) qué construir y en qué orden.
> El objetivo del II Avance es tener las **pantallas reales en código** y la **API funcionando**,
> con la configuración inicial lista. Ábrelo junto con `CLAUDE.md`.

## Stack (resumen)

- **Frontend:** Next.js (PWA) + TypeScript + Tailwind + shadcn/ui → se despliega en **Vercel**.
- **API:** **NestJS** (Node.js) + **Prisma** + **PostgreSQL**, auth **JWT** → contenedor **Docker**, se despliega en **Render**.
- **DevOps:** **Docker** (validar en local), **Husky** (hooks de Git), **GitHub Actions** (CI/CD).
- **Almacenamiento:** object storage (Cloudinary o Supabase Storage) para archivos.

## Estado actual del repositorio

- **Frontend Next.js YA inicializado en la raíz de `Vetify/`** (TypeScript, `src/`, App Router).
- `supabase/schema.sql` — modelo de datos de referencia (base para `prisma/schema.prisma`).
- `CLAUDE.md`, `docs/ARQUITECTURA.md`, `docs/MODELO_DATOS.md` — contexto y documentación.
- `docs/diseno/` — **referencia visual**: `mockups.html` (abrir en el navegador) y las capturas.
  Claude Code debe replicar estas pantallas como componentes reales.

Falta configurar el frontend (PWA, tema, deps), crear el **API NestJS en `api/`**, y programar todo.

---

## Fase 0 — Dependencias y estructura

El frontend ya existe en la raíz. Desde `Vetify/`:

```bash
# 1) Dependencias del frontend (en la raíz)
npm install @tanstack/react-query zustand recharts qrcode jspdf date-fns lucide-react next-pwa
npx shadcn@latest init
npx shadcn@latest add button card input badge tabs avatar switch progress dialog

# 2) Crear el API NestJS en api/
npm i -g @nestjs/cli
nest new api --package-manager npm --skip-git

# 3) Dependencias del API (dentro de api/)
cd api
npm install @prisma/client @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt @nestjs/config @nestjs/swagger
npm install -D prisma @types/passport-jwt @types/bcrypt
npx prisma init
cd ..
```

## Fase 1 — Base de datos y Prisma (en `api/`)

1. Traducir `supabase/schema.sql` a `api/prisma/schema.prisma` (mismas tablas y relaciones).
2. Configurar `DATABASE_URL` en `api/.env` apuntando a un PostgreSQL gestionado (Neon o Supabase).
3. `npx prisma migrate dev` para crear las tablas y `npx prisma generate` para el cliente tipado.

## Fase 2 — API NestJS: autenticación y módulos

1. **Auth:** módulo con registro/login, JWT (`@nestjs/jwt` + Passport), hash con bcrypt, guard por rol (`dueño` / `clinica`).
2. **Módulos REST:** `mascotas`, `expediente` (consultas, vacunas, desparasitaciones, exámenes, peso), `permisos`, `clinicas`. Cada endpoint valida DTOs y aplica la autorización (una clínica solo accede a una mascota con `permiso` activo; registrar en `bitacora_accesos`).
3. **Módulo IA:** endpoint que calcula anomalías de peso (regla por rango de raza/edad) y genera el resumen previo.
4. Documentar la API con Swagger (`@nestjs/swagger`).

## Fase 3 — Docker + DevOps

1. `api/Dockerfile` (multi-stage) y `docker build` / `docker run` para validar el contenedor en local.
2. **Husky:** `pre-commit` (lint + format) y `pre-push` (test) en cada paquete.
3. **GitHub Actions:** workflow que corre lint, pruebas y build del frontend (raíz) y `api/`; y despliega (Vercel el front, Render el API).

## Fase 4 — Frontend: pantallas reales

Implementar como componentes de React que consumen el API. Usa `docs/diseno/mockups.html`
como referencia exacta de layout y estilo (paleta verde + dorado, tipografía Fraunces):

1. **Registro / ingreso** (llama al API de auth, guarda el JWT).
2. **Mis mascotas (Inicio)** — lista desde el API.
3. **Perfil de la mascota** — datos y edición.
4. **Expediente clínico** — línea de tiempo (consultas, vacunas, desparasitaciones, exámenes, peso).
5. **Esquema de vacunación** — progreso y vigencias.
6. **Carné digital (QR)** — token firmado por el API + QR con `qrcode`; exporta PDF.
7. **Analítica de peso** — gráfica con `recharts` + anomalías del módulo de IA.
8. **Permisos y consentimiento** — activar/revocar acceso de clínicas.
9. **Portal de la clínica** — lista de pacientes, agenda y panel de adherencia/retorno.

## Fase 5 — Despliegue y capturas

1. Front a Vercel, API (Docker) a Render, PostgreSQL gestionado.
2. Con las pantallas corriendo, toma una captura de cada una para la documentación del avance.

---

## Prompts listos para pegar en Claude Code

**Arranque (Fase 0 y 1):**

> Lee `CLAUDE.md` y `docs/PLAN_DESARROLLO.md`. El frontend Next.js ya está en la raíz: instala sus
> dependencias y configura PWA, Tailwind (paleta + Fraunces) y shadcn/ui. Luego crea el `api/` con
> NestJS (Fase 0) y la Fase 1: traduce `supabase/schema.sql` a `api/prisma/schema.prisma`, configura
> Prisma con PostgreSQL y deja las migraciones listas. No borres `supabase/`, `docs/` ni `CLAUDE.md`.

**API (Fase 2):**

> En `api/` implementa el módulo de autenticación con JWT (Passport + bcrypt) y roles dueño/clínica,
> y el módulo `mascotas` con CRUD y autorización por permisos. Agrega Swagger.

**Docker y CI (Fase 3):**

> Crea `api/Dockerfile` multi-stage y valida el contenedor en local. Configura Husky (pre-commit y
> pre-push) y un workflow de GitHub Actions que corra lint, test y build del frontend (raíz) y `api/`.

**Pantallas del frontend (Fase 4), una por una:**

> Implementa la pantalla "Mis mascotas (Inicio)" en el frontend (raíz) como en `docs/diseno/mockups.html`,
> consumiendo el endpoint del API. Respeta la paleta y usa shadcn/ui. Luego seguimos con la siguiente.
