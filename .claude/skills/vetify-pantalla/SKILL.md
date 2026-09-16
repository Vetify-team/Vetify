---
name: vetify-pantalla
description: Implementar una pantalla del frontend Next.js de Vetify a partir de los mockups: hook de datos, api-client tipado, componente shadcn, estados de carga/error/offline y captura para la documentación.
---

# Pantalla del frontend de Vetify

Referencia visual obligatoria: `docs/diseno/mockups.html` (abrir en el navegador) y las capturas de `docs/diseno/`. Las pantallas se implementan como **componentes reales**, nunca como imágenes incrustadas.

## Orden de trabajo

1. **Contrato.** Confirmar que el endpoint existe y que su tipo está en `packages/types`. Si no existe, se hace primero el módulo del API — no se inventan datos ni se mockean tipos locales.

2. **Cliente.** Agregar la llamada en `apps/web/src/lib/api-client.ts`, tipada con `packages/types`. El `fetch` crudo no se usa dentro de los componentes.

3. **Hook.** Crear `apps/web/src/hooks/use<Recurso>.ts` con TanStack Query (`queryKey` estable, invalidación tras mutaciones). Este hook es lo que se reutiliza tal cual si algún día se agrega `apps/mobile`, así que **no debe importar nada de `next/*`**.

4. **Componente.** Construir con shadcn/ui respetando paleta verde + dorado y tipografía Fraunces. Server Component por defecto; `"use client"` solo donde hay interactividad real.

5. **Estados.** Ninguna pantalla se da por hecha sin: carga (skeleton, no spinner suelto), error con mensaje en español accionable, vacío con llamado a la acción, y comportamiento offline razonable (es una PWA: los datos ya cacheados deben seguir viéndose).

6. **Accesibilidad y móvil.** Se diseña primero a ancho de teléfono. Objetivos táctiles cómodos, contraste suficiente, etiquetas en los campos.

7. **Evidencia.** Tomar captura de la pantalla corriendo y guardarla en `docs/diseno/` — es material directo para el avance y la defensa.

## Reglas específicas del producto

- El dueño ve **sus** mascotas; la clínica ve solo pacientes con permiso activo. Si la UI muestra algo que el API podría negar, está mal planteada.
- La pantalla de permisos debe dejar clarísimo qué clínica ve qué y permitir **revocar en un toque**.
- El carné QR se genera desde un token firmado por el API, nunca armado en el cliente.
- Las gráficas de peso usan Recharts y marcan visualmente las anomalías que reporta el módulo de IA.

## Cierre

`pnpm turbo run lint typecheck build --filter=web` en verde, y commit `feat(web): pantalla <nombre>`.
