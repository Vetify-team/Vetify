# Arquitectura e infraestructura — Vetify

Infraestructura 100 % en la nube, en cuatro capas, con DevOps y seguridad como ejes
transversales.

## 1. Clientes
- **App del dueño (PWA):** instalable en Android/iOS y navegador.
- **Portal web de la clínica:** agenda, expedientes, adherencia y retorno.
- **Verificador de carné (QR):** hospedajes, guarderías y aerolíneas confirman vigencia sin ver
  el expediente completo.

Acceden por **HTTPS/TLS**.

## 2. Frontend — Next.js en Vercel
- Next.js (React + TypeScript + Tailwind), red edge/CDN global, PWA con Service Worker.
- **Web Push (VAPID)** para recordatorios.
- Se comunica con el API por **REST/JSON** con **JWT (Bearer)**.

## 3. API — NestJS en Render (contenedor Docker)
- **Auth (JWT):** Passport + bcrypt, roles `dueño` y `clinica`.
- **Módulos REST:** mascotas, expediente, vacunas, permisos, clínicas.
- **Prisma ORM:** acceso tipado a PostgreSQL.
- **Módulo de IA:** anomalías de peso, clasificación de motivo y resumen previo.
- **Docker:** la imagen del API se valida en local y se despliega en Render.

## 4. Datos y almacenamiento
- **PostgreSQL gestionado** (Neon o Supabase): expediente, esquemas y permisos.
- **Object storage** (Cloudinary o Supabase Storage): fotos, exámenes y PDF.

## DevOps (transversal)
Docker (local y Render) · Husky (hooks pre-commit / pre-push) · GitHub Actions (lint, test,
build y deploy) · despliegue en Vercel (front) y Render (API).

## Seguridad y datos (transversal)
HTTPS/TLS · JWT con autorización por rol · consentimiento revocable y permisos por mascota ·
bitácora de accesos · respaldos y monitoreo.
