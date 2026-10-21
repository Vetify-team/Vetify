---
slug: /
sidebar_position: 1
title: Vetify
---

<p className="etiqueta">Documentación técnica</p>

# Vetify

**Expediente clínico compartido para mascotas.** El expediente pertenece al dueño, no a la
clínica: lo alimentan el dueño (peso, alimentación, observaciones) y las clínicas a las que él
da acceso (consultas, vacunas, tratamientos, exámenes). Es único, portátil y acompaña al animal
toda su vida.

Este sitio documenta cómo está construido y cómo usar el API.

## Qué hay acá

| Sección                                         | Para qué                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| [Primeros pasos](./primeros-pasos.md)           | Levantar la base, el API y la web en tu máquina.                             |
| [Arquitectura](./arquitectura.md)               | Cómo se reparten las responsabilidades en el monorepo.                       |
| [API](./api/convenciones.md)                    | Convenciones, autenticación, autorización, expediente, vacunación y errores. |
| [Referencia del API](pathname:///referencia)    | Cada endpoint con sus esquemas, generada del código.                         |
| [Modelo de datos](./modelo-de-datos.md)         | Las tablas y cómo se relacionan.                                             |
| [Agregar un endpoint](./agregar-un-endpoint.md) | El recorrido completo, del contrato a la documentación.                      |

## La regla que sostiene todo

:::info Una clínica accede a una mascota solo si existe un permiso activo otorgado por el dueño.

- Se verifica **en el API**, en un único lugar, en cada petición.
- Es **revocable**: el dueño quita el acceso y la clínica lo pierde en la siguiente petición.
- Queda **en bitácora**: cada acceso registra quién, qué y cuándo.

:::

Proyecto del curso EIF409 Aplicaciones Informáticas Globales, Universidad Nacional, Sede
Brunca, II ciclo 2026. Equipo: Francisco Mora Cabezas y Alejandro León Marín.
