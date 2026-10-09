---
name: vetify-convenciones
description: Convenciones del monorepo Vetify (Turborepo + Next.js PWA + NestJS + Prisma + Neon). Usar al escribir, revisar o estructurar cualquier código, documentación o commit del proyecto Vetify.
---

# Convenciones de Vetify

Vetify es un expediente clínico compartido para mascotas. El expediente **pertenece al dueño**, no a la clínica. Proyecto del curso EIF409 (UNA, Sede Brunca). Equipo: Francisco Mora y Alejandro León.

## Estructura del monorepo

```
apps/web      Next.js 16 App Router — PWA (Serwist). App del dueño + portal de clínica.
apps/api      NestJS + Prisma + PostgreSQL (Neon). Toda la lógica de negocio y autorización.
apps/mobile   Expo/React Native. Reservada; solo se llena si se exige app nativa.
packages/types   Contratos compartidos (DTOs + esquemas Zod). Fuente única de verdad.
packages/config  eslint / tsconfig / prettier compartidos.
```

Reglas duras:

- **Ningún tipo de dominio se define dos veces.** Si `web` y `api` hablan de una `Mascota`, el tipo vive en `packages/types` y ambos lo importan. Nunca copiar una interfaz entre apps.
- **`apps/web` nunca habla con la base de datos.** Todo pasa por el API vía `src/lib/api-client.ts`. No hay cliente de Supabase ni de Prisma en el frontend.
- **La autorización se aplica en `apps/api`**, nunca solo en la UI. Ocultar un botón no es autorizar.

## Seguridad del expediente (no negociable)

- Una clínica accede a una mascota **solo** si existe un registro activo en `permisos` para una clínica a la que pertenece el usuario. Verificarlo en el servicio, no en el controlador.
- **Todo acceso al expediente escribe en `bitacora_accesos`.** Preferir un interceptor de Nest para que no dependa de que alguien se acuerde.
- El consentimiento del dueño es **revocable**: revocar un permiso corta el acceso de inmediato.
- Contraseñas con **argon2** (no bcrypt). Access token corto + refresh token rotado y guardado hasheado.
- `@nestjs/throttler` en login, registro y verificación de carné QR.
- La ruta pública `/verificar/[token]` expone **solo vigencia de vacunas**, jamás el expediente completo.

## Idioma

- UI, textos y documentación: **español** (con tildes correctas).
- Tablas y columnas de la base de datos: **español** (`mascotas`, `fecha_aplicacion`).
- Código: inglés técnico o español claro, pero consistente dentro de cada archivo.
- Commits convencionales en español: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.

## Stack decidido (no reabrir sin discutirlo)

TypeScript de punta a punta · Next.js 16 + Tailwind + shadcn/ui · Serwist para PWA (no `next-pwa`) · TanStack Query + Zustand · NestJS 12 + Prisma + PostgreSQL en Neon · JWT con Passport + argon2 · Docker para el API · Vercel (web) + Render (api) · Turborepo + pnpm · Husky + lint-staged + GitHub Actions · **Vitest** en ambas apps · pino para logs · Recharts, `qrcode`, jsPDF.

Dos precisiones que salieron del refactor a monorepo y conviene no revertir por descuido:

- **`apps/api` es ESM y trae Vitest y oxlint**, no Jest ni ESLint: es lo que genera hoy el CLI de NestJS 12. `apps/web` y `packages/types` sí usan ESLint.
- **Prisma está fijado en 7.10.0.** El `latest` de npm es un release candidate de la 8 con una CLI completamente distinta (`contract`, `migration plan`), donde no existen `migrate dev` ni `generate`. No actualizar sin discutirlo.
- En Prisma 7 la URL de conexión **no va en `schema.prisma`**: vive en `prisma.config.ts` y el cliente se conecta por el adaptador de `pg`.

## Antes de dar algo por terminado

1. `pnpm turbo run lint typecheck test build` pasa en limpio desde la raíz.
2. Si cambió el contrato del API, se actualizó `packages/types` y Swagger.
3. Si cambió el modelo de datos, hay migración de Prisma **y** `docs/MODELO_DATOS.md` actualizado.
4. No hay secretos en el repo; lo nuevo está en el `.env.example` correspondiente.
