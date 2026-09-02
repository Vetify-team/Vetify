# Vetify 🐾

**Expediente clínico compartido para mascotas.** Aplicación móvil + web (PWA) donde el
expediente pertenece al dueño y lo acompaña toda la vida, sin importar cuántas clínicas lo
atiendan.

Proyecto del curso **EIF409 Aplicaciones Informáticas Globales** — UNA, Sede Brunca, 2026.
Equipo: Francisco Mora Cabezas · Alejandro León Marín.

## Stack

Next.js 14 + TypeScript + Tailwind (PWA) · Supabase (PostgreSQL, Auth, Storage, Edge
Functions) · Vercel. Ver [`CLAUDE.md`](./CLAUDE.md) para el contexto completo y
[`docs/`](./docs) para arquitectura y modelo de datos.

## Documentos del I Avance

- `Vetify_Avance1.docx` — documento del avance (BMC, propuesta de desarrollo, mockups).
- `Vetify_Presentacion.html` — presentación para clase.

## Puesta en marcha (cuando el código esté inicializado)

```bash
cp .env.example .env.local   # configurar llaves de Supabase
npm install
npm run dev
```

## Estructura

Ver [`CLAUDE.md`](./CLAUDE.md) → sección "Estructura del proyecto".
