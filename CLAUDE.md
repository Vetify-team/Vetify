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

- **Lenguaje:** TypeScript en todo el proyecto.
- **Frontend / PWA:** Next.js 14 (App Router) + React 18, Tailwind CSS + shadcn/ui.
  Configurado como PWA instalable (Service Worker + Web App Manifest) para cubrir móvil y web
  con una sola base de código.
- **Estado / datos:** TanStack Query (datos de servidor) + Zustand (estado local liviano).
- **Backend (BaaS):** **Supabase** — PostgreSQL, Auth, Storage, Realtime y Edge Functions.
- **Auth:** Supabase Auth (correo + Google). Roles: `dueño` y `clinica`.
- **Gráficas:** Recharts. **QR:** `qrcode`. **PDF:** `jsPDF`. **Push:** Web Push API (VAPID).
- **IA:** Edge Function (detección de anomalías de peso, clasificación de motivo, resumen previo).
- **Hosting / CI-CD:** Vercel + GitHub Actions. **Repo:** GitHub.

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
        │  HTTPS/TLS · REST + Realtime · JWT
Presentación: Next.js en Vercel (edge/CDN) · Service Worker · Web Push (VAPID)
        │
Backend: Supabase → Auth · PostgreSQL (RLS) · Storage · Edge Functions · Realtime
        │
IA e integraciones: módulo de anomalías · calendario (ICS) · referidos
Transversal: HTTPS/TLS · Row Level Security · consentimiento revocable · bitácora · backups · CI/CD
```

Ver `docs/ARQUITECTURA.md` y `docs/MODELO_DATOS.md` para el detalle.

## Estructura del proyecto (objetivo)

```
/app                 Rutas Next.js (App Router)
  /(dueño)           App del dueño: mascotas, expediente, vacunas, carné
  /(clinica)         Portal de la clínica: pacientes, agenda, adherencia
  /(auth)            Login / registro
/components          Componentes UI (shadcn/ui)
/lib                 Cliente Supabase, helpers, tipos
/supabase
  schema.sql         Esquema de base de datos (fuente de verdad del modelo)
  /functions         Edge Functions (QR, PDF, IA)
/public              Manifest PWA, íconos, service worker
/docs                Documentación del proyecto
```

## Convenciones

- **Idioma:** UI y textos en **español**; código, nombres de variables y commits en español
  claro o inglés técnico, consistente. Nombres de tablas/columnas en **español** (ver schema).
- **Commits:** estilo convencional en español — `feat:`, `fix:`, `docs:`, `refactor:`,
  `chore:`. Mensajes concisos.
- **Seguridad primero:** toda tabla del expediente lleva **Row Level Security**. Nunca exponer
  datos de una mascota a una clínica sin un registro activo en `permisos`. Cada acceso al
  expediente escribe en `bitacora_accesos`.
- **Tipado:** generar tipos de Supabase (`supabase gen types typescript`) y usarlos en el front.
- **No** poner llaves/secretos en el repo: usar `.env.local` (ver `.env.example`).

## Comandos (una vez inicializado)

```bash
npm run dev            # entorno de desarrollo
npm run build          # build de producción
npm run lint           # linting
npx supabase start     # Supabase local (Docker)
npx supabase db push   # aplicar schema.sql
```

## Estado actual y próximos pasos

- **Hecho (I Avance):** modelo de negocio (BMC), propuesta de desarrollo (este stack), modelo
  de datos (`supabase/schema.sql`), infraestructura y mockups. Documento en
  `Vetify_Avance1.docx` y presentación en `Vetify_Presentacion.html` (raíz del proyecto).
- **Siguiente (II Avance, 9 oct 2026):** avance funcional — **autenticación**, **expediente**
  y **esquema de vacunación**. Empezar por: inicializar Next.js + Supabase, aplicar el schema,
  implementar auth con roles, y el CRUD de mascotas + expediente.
- **Final (13 nov 2026):** analítica + IA, manuales, defensa.

## Para Claude Code: cómo arrancar el código

1. Inicializar el proyecto Next.js con TypeScript, Tailwind y App Router.
2. Añadir Supabase (`@supabase/supabase-js`, `@supabase/ssr`) y crear el cliente en `/lib`.
3. Aplicar `supabase/schema.sql` (incluye tablas, relaciones y políticas RLS base).
4. Configurar PWA (manifest + service worker) y shadcn/ui.
5. Implementar auth con roles y las pantallas del expediente (ver mockups del Avance 1).
