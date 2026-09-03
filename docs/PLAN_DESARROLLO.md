# Plan de desarrollo para Claude Code — Vetify

> Este archivo le dice a **Claude Code** (en VS Code) qué construir y en qué orden.
> El objetivo del II Avance es tener las **pantallas reales en código** (no imágenes),
> con la configuración inicial funcionando. Ábrelo junto con `CLAUDE.md`.

## Estado actual del repositorio

Hoy este repo contiene **solo el contexto y el diseño**, NO el proyecto Next.js todavía:

- `CLAUDE.md` — contexto, stack y convenciones.
- `supabase/schema.sql` — modelo de datos (fuente de verdad).
- `docs/ARQUITECTURA.md`, `docs/MODELO_DATOS.md` — documentación.
- `docs/diseno/` — **referencia visual**: `mockups.html` (abrir en el navegador) y las
  capturas de cada pantalla. Claude Code debe replicar estas pantallas como componentes reales.

Falta **inicializar el proyecto Next.js** y **programar las pantallas**. Eso es lo que sigue.

---

## Fase 0 — Inicializar el proyecto (una sola vez)

Ejecuta en la terminal, dentro de la carpeta `Vetify/`:

```bash
# 1) Crear el proyecto Next.js (TypeScript, Tailwind, App Router, ESLint)
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm

# 2) Dependencias del proyecto
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query zustand \
  recharts qrcode jspdf date-fns lucide-react

# 3) shadcn/ui (componentes accesibles)
npx shadcn@latest init
npx shadcn@latest add button card input badge tabs avatar switch progress dialog

# 4) PWA (instalable en el teléfono)
npm install next-pwa

# 5) Variables de entorno
cp .env.example .env.local   # luego pega tus llaves de Supabase
```

> Nota: `create-next-app` puede preguntar si sobrescribe archivos existentes (README, etc.).
> Acepta conservar este `CLAUDE.md`, `supabase/` y `docs/`.

## Fase 1 — Configuración inicial (pídeselo a Claude Code)

1. Crear el cliente de Supabase en `src/lib/supabase/` (cliente de navegador y de servidor con `@supabase/ssr`).
2. Configurar `next-pwa` en `next.config.js` y crear `public/manifest.json` con el ícono de Vetify.
3. Envolver la app con el proveedor de TanStack Query.
4. Definir el tema de Tailwind con la paleta de Vetify: verde `#1B5540`, verde oscuro `#124030`, dorado `#C2A05A`, crema `#FAF6EC`. Tipografía serif **Fraunces** para títulos.
5. Crear el proyecto en [supabase.com](https://supabase.com), y en el editor SQL **ejecutar `supabase/schema.sql`** para crear las tablas y las políticas RLS.

## Fase 2 — Autenticación y roles

- Pantalla **1. Registro / ingreso** (ver `docs/diseno/`): login con correo y Google usando Supabase Auth.
- Manejo de sesión con `@supabase/ssr` y middleware de Next.js.
- Roles `dueño` y `clinica` (tabla `usuarios`); redirigir según el rol tras el login.

## Fase 3 — App del dueño (pantallas reales)

Implementar como componentes de React con datos de Supabase. Usa `docs/diseno/mockups.html`
como referencia exacta de layout y estilo:

1. **Inicio / Mis mascotas** — lista de mascotas con estado del esquema.
2. **Perfil de la mascota** — datos y edición (tabla `mascotas`).
3. **Expediente clínico** — línea de tiempo de `consultas`, `vacunas`, `desparasitaciones`, `examenes`, `registros_peso`.
4. **Esquema de vacunación** — progreso y vigencias, cálculo a partir de `esquemas_vacunacion`.
5. **Carné digital (QR)** — genera un token firmado y su QR con `qrcode`; exporta PDF con `jspdf`.
6. **Analítica de peso** — gráfica con `recharts`; regla simple de anomalía (fuera de rango por raza/edad).
7. **Permisos y consentimiento** — activar/revocar acceso de clínicas (tabla `permisos`), con bitácora.

## Fase 4 — Portal de la clínica

- **Lista de pacientes**, agenda y panel de adherencia/retorno (ver mockup del portal web).
- Una clínica solo ve las mascotas con un `permiso` activo (lo garantiza el RLS del schema).

## Fase 5 — Capturas para el documento

Cuando las pantallas estén corriendo (`npm run dev`), toma una captura de cada una y
reemplaza los espacios "[ Espacio para captura de pantalla ]" del documento del avance.

---

## Prompts listos para pegar en Claude Code

**Arranque (Fase 0 y 1):**

> Lee `CLAUDE.md` y `docs/PLAN_DESARROLLO.md`. Inicializa el proyecto Next.js siguiendo la Fase 0
> (TypeScript, Tailwind, App Router, src-dir) e implementa la Fase 1: cliente de Supabase con
> `@supabase/ssr`, configuración de `next-pwa` con `manifest.json`, proveedor de TanStack Query y
> el tema de Tailwind con la paleta y la tipografía Fraunces. No borres `supabase/`, `docs/` ni `CLAUDE.md`.

**Autenticación (Fase 2):**

> Implementa la autenticación con Supabase Auth (correo y Google) y la pantalla de ingreso/registro
> según `docs/diseno/mockups.html` (pantalla 1). Maneja sesión con middleware y separa por rol dueño/clínica.

**Pantallas del dueño (Fase 3), una por una:**

> Implementa la pantalla "Mis mascotas (Inicio)" como en `docs/diseno/mockups.html`, leyendo de la tabla
> `mascotas` en Supabase. Respeta la paleta y usa componentes de shadcn/ui. Luego seguimos con la siguiente.

Repite el prompt anterior cambiando el nombre de la pantalla (Perfil, Expediente, Vacunas, Carné, Peso, Permisos).
