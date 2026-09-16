# CLAUDE.md — Vetify

> Contexto del proyecto para Claude Code (VS Code). Léelo antes de escribir código.

## Qué es Vetify

Aplicación **móvil + web (PWA)** de **expediente clínico compartido para mascotas**. El
expediente **pertenece al dueño** y es alimentado por dos partes: el dueño registra el día a
día (peso, alimentación, observaciones) y la clínica veterinaria registra el acto médico
(consultas, vacunas, tratamientos, exámenes). Es único, portátil y acompaña al animal toda su
vida, sin importar cuántas clínicas lo atiendan.

**Diferenciador:** los sistemas actuales pertenecen a la clínica y encierran los datos. Vetify
invierte la propiedad: el dueño posee el expediente y decide, con consentimiento revocable,
qué clínicas lo consultan.

Curso: **EIF409 Aplicaciones Informáticas Globales**, UNA, Sede Brunca, II Ciclo 2026.
Equipo: **Francisco Mora Cabezas** y **Alejandro León Marín**.

## Stack (decidido)

- **Lenguaje:** TypeScript de extremo a extremo (frontend y API).
- **Frontend / PWA:** Next.js 14 (App Router) + React 18, Tailwind CSS + shadcn/ui.
  PWA instalable (Service Worker + Web App Manifest); una sola base de código para móvil y web.
- **Estado / datos:** TanStack Query (datos de servidor) + Zustand (estado local liviano).
- **API / backend:** **NestJS** (Node.js) — API REST modular. Es el framework que queremos aprender.
- **ORM:** **Prisma** sobre **PostgreSQL** (gestionado: Neon o Supabase).
- **Auth:** **JWT** en NestJS (Passport + bcrypt). Roles: `dueño` y `clinica`.
- **Almacenamiento:** object storage (Cloudinary o Supabase Storage) para fotos, exámenes y PDF.
- **Gráficas:** Recharts. **QR:** `qrcode`. **PDF:** PDFKit/`jsPDF`. **Push:** Web Push API (VAPID).
- **IA:** módulo dentro del API NestJS (anomalías de peso, clasificación de motivo, resumen previo).
- **Contenedores:** **Docker** (imagen del API; se valida en local y se despliega en Render).
- **Calidad:** ESLint + Prettier, **Jest** (pruebas), **Husky** (hooks de Git: pre-commit / pre-push).
- **CI/CD:** **GitHub Actions** (lint, test, build y deploy).
- **Hosting:** **Vercel** (frontend) y **Render** (API en contenedor). **Repo:** GitHub.

## Cómo se cumplen los elementos del curso

- **Captura:** perfil de mascota, consultas, vacunas, desparasitaciones, tratamientos,
  exámenes, peso, alimentación.
- **Proceso:** esquema automático de vacunación/desparasitación por país+especie+edad, control
  de vigencias, recordatorios, consolidación del expediente entre clínicas.
- **Salidas:** carné digital con QR verificable, resumen imprimible, gráficas de peso e
  historial, exportación PDF, integración con calendario (ICS), notificaciones push.
- **Análisis:** curva de peso vs. rango esperado, frecuencia/motivo de consultas, adherencia;
  para la clínica: retorno y esquemas vencidos.
- **IA:** anomalías de peso, clasificación de motivo, resumen previo a la consulta.

## Arquitectura (resumen)

```
Clientes: App dueño (PWA) · Portal clínica (web) · Verificador QR (terceros)
        │  HTTPS/TLS
Frontend: Next.js (PWA) en Vercel · Service Worker · Web Push (VAPID)
        │  API REST · JSON · JWT (Bearer)
API: NestJS en Render (Docker) → Auth JWT · Módulos REST · Prisma · Módulo IA
        │  SSL
Datos: PostgreSQL gestionado (Neon/Supabase) · Object storage (Cloudinary/Supabase)
DevOps: Docker · Husky · GitHub Actions (CI/CD) · deploy Vercel + Render
Seguridad: HTTPS/TLS · JWT + autorización por rol · consentimiento y permisos · bitácora · backups
```

Ver `docs/ARQUITECTURA.md` y `docs/MODELO_DATOS.md` para el detalle.

## Estructura del proyecto

El **frontend Next.js ya está inicializado en la raíz de `Vetify/`** (App Router, `src/`, PWA por
configurar). El **API NestJS** vive en la subcarpeta `api/`.

```
Vetify/
  src/app            Rutas del frontend: (auth), (dueño), (clinica)
  src/components      Componentes UI (shadcn/ui)
  src/lib             Cliente HTTP del API, helpers, tipos
  public/             Manifest PWA, íconos, service worker
  package.json        Frontend Next.js (raíz)
  api/                API NestJS
    src/              Módulos: auth, mascotas, expediente, vacunas, permisos, ia
    prisma/           schema.prisma y migraciones
    Dockerfile        Imagen del API para local y Render
  supabase/
    schema.sql        Modelo de datos de referencia (Postgres) — base para prisma/schema.prisma
  docs/               Documentación y diseño (docs/diseno/mockups.html)
  .github/workflows/  GitHub Actions (CI/CD)
```

> El frontend en la raíz se despliega en Vercel; el API en `api/` (contenedor Docker) en Render.

## Convenciones

- **Idioma:** UI y textos en **español**; código, nombres de variables y commits en español
  claro o inglés técnico, consistente. Nombres de tablas/columnas en **español** (ver schema).
- **Commits:** estilo convencional en español — `feat:`, `fix:`, `docs:`, `refactor:`,
  `chore:`. Mensajes concisos.
- **Seguridad primero:** la autorización se aplica en el API. Nunca exponer datos de una mascota
  a una clínica sin un registro activo en `permisos`. Cada acceso al expediente escribe en
  `bitacora_accesos`.
- **Tipado:** usar el cliente generado por **Prisma** (`prisma generate`) en el API; en el front,
  tipos compartidos del contrato del API.
- **No** poner llaves/secretos en el repo: usar `.env` / `.env.local` (ver `.env.example`).

## Comandos (una vez inicializado)

```bash
# Frontend (web/)
npm run dev            # Next.js en desarrollo
npm run build          # build de producción

# API (api/)
npm run start:dev      # NestJS en desarrollo (watch)
npx prisma migrate dev # aplicar migraciones a PostgreSQL
npx prisma generate    # generar el cliente tipado
docker build -t vetify-api .   # construir la imagen del API
docker run -p 3001:3001 vetify-api   # validar el contenedor en local
```

## Estado actual y próximos pasos

- **Hecho (I Avance):** modelo de negocio (BMC), propuesta de desarrollo (este stack), modelo
  de datos (`supabase/schema.sql`), infraestructura y diseño de pantallas.
- **Frontend Next.js ya inicializado** en la raíz de `Vetify/`. Falta configurar la PWA, el tema y
  las pantallas, y crear el **API NestJS** en `api/`. El siguiente paso es programarlo.
- **Siguiente (II Avance, 9 oct 2026):** avance funcional — **autenticación**, **expediente**
  y **esquema de vacunación**.
- **Final (13 nov 2026):** analítica + IA, manuales, defensa.

## Para Claude Code: cómo arrancar el código

Sigue **`docs/PLAN_DESARROLLO.md`**, que tiene los comandos de inicialización, la configuración
inicial y las fases para implementar cada pantalla, con prompts listos para pegar.

Referencia de diseño: **`docs/diseno/mockups.html`** (ábrelo en el navegador) muestra el objetivo
visual exacto de cada pantalla. Las pantallas deben implementarse como componentes reales que
repliquen ese diseño, no como imágenes.

Resumen del arranque (detalle completo en el plan):

1. El frontend Next.js ya existe en la raíz: configurar PWA, Tailwind (paleta + Fraunces) y shadcn/ui.
2. Crear el `api/` con NestJS; configurar Prisma con PostgreSQL a partir de `supabase/schema.sql` y auth JWT con roles.
3. Añadir `Dockerfile` al API y validar el contenedor en local.
4. Configurar Husky (hooks) y GitHub Actions (lint, test, build, deploy a Vercel y Render).
5. Implementar auth y luego las pantallas del expediente replicando `docs/diseno/mockups.html`.
