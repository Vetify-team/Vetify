---
sidebar_position: 5
title: Esquema de vacunación y avisos
---

# Esquema de vacunación y avisos

El "proceso" central del expediente: cruzar el esquema preventivo del país con lo que se
aplicó y la edad de la mascota.

## Catálogo

`esquemas_vacunacion` guarda las reglas por país, especie y edad. El de Costa Rica viene en la
migración `esquemas_vacunacion_cr`:

| Especie | Vacuna              | Edad mínima | Vigencia |
| ------- | ------------------- | ----------- | -------- |
| Perro   | Polivalente         | 2 meses     | 12 meses |
| Perro   | Leptospirosis       | 3 meses     | 12 meses |
| Perro   | Rabia               | 3 meses     | 12 meses |
| Perro   | Tos de las perreras | 3 meses     | 12 meses |
| Gato    | Triple felina       | 2 meses     | 12 meses |
| Gato    | Leucemia felina     | 2 meses     | 12 meses |
| Gato    | Rabia               | 3 meses     | 12 meses |

Agregar un país es agregar filas: el cálculo no cambia.

## Estado de una mascota

`GET /mascotas/<mascotaId>/vacunacion` devuelve, por cada vacuna del esquema:

| Estado          | Cuándo                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `vigente`       | Aplicada y con más de 30 días de protección.                                                          |
| `por_vencer`    | Aplicada y vence en 30 días o menos.                                                                  |
| `vencida`       | Aplicada, pero la protección ya expiró.                                                               |
| `pendiente`     | Nunca aplicada y la mascota ya tiene la edad mínima. Sin fecha de nacimiento se asume que ya le toca. |
| `no_aplica_aun` | La mascota todavía no tiene la edad mínima; `proximaFecha` dice desde cuándo.                         |

Se usa la última aplicación de cada vacuna. El vencimiento es el que registró la clínica o,
si no lo indicó, la aplicación más la vigencia del esquema.

Además trae:

- `cobertura`: porcentaje del esquema con protección vigente (cuenta `por_vencer`).
- `desparasitaciones`: la última de cada tipo (interna, externa) con su próxima fecha y el
  mismo tipo de estado.

## Avisos

`GET /avisos` junta lo anterior para todas las mascotas visibles: las del dueño, o los pacientes
de la clínica. Viene ordenado con lo atrasado primero (`vencida`, `pendiente`, `por_vencer`) y
después por fecha.

```json
[
  {
    "mascotaId": "…",
    "mascotaNombre": "Rocco",
    "tipo": "vacuna",
    "nombre": "Leptospirosis",
    "fecha": "2026-08-02",
    "estado": "vencida"
  }
]
```

- El dueño lo ve como "Próximo aviso" y en la pestaña Avisos, y lo puede exportar a su calendario
  (`.ics`).
- La clínica lo ve como **Esquemas vencidos**: a qué pacientes llamar. Cada paciente consultado
  queda en la bitácora.

## Zona horaria

Las fechas de vacunas son fechas sin hora. Para el API, "hoy" es el día en **Costa Rica**
(`America/Costa_Rica`): después de las 6 p. m. la fecha UTC ya es la del día siguiente y una
vacuna que vence en un año aparecería a "12 meses".
