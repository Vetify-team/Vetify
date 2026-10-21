---
sidebar_position: 4
title: Expediente
---

# Expediente

El expediente de una mascota tiene dos fuentes, y cada una escribe solo lo suyo:

| Quién                      | Qué registra | Rutas (`POST /mascotas/<mascotaId>/…`)                                  |
| -------------------------- | ------------ | ----------------------------------------------------------------------- |
| Clínica con permiso activo | Acto médico  | `consultas`, `vacunas`, `desparasitaciones`, `tratamientos`, `examenes` |
| Dueño                      | Día a día    | `peso`, `alimentacion`                                                  |

Ambos leen todo con `GET /mascotas/<mascotaId>/expediente`, sin importar qué clínica registró
cada cosa.

## Mascotas

| Ruta                          | Quién                       | Qué hace                                                                    |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `GET /mascotas`               | Dueño / clínica             | El dueño recibe sus mascotas; la clínica, sus pacientes con permiso activo. |
| `POST /mascotas`              | Dueño                       | Registra una mascota. Solo `nombre` y `especie` son obligatorios.           |
| `GET /mascotas/<mascotaId>`   | Dueño / clínica con permiso | Perfil.                                                                     |
| `PATCH /mascotas/<mascotaId>` | Dueño                       | Edita el perfil.                                                            |

## Registrar el acto médico

Una vacuna, desde la clínica:

```bash
curl -X POST http://localhost:3001/api/mascotas/<mascotaId>/vacunas \
  -H "Authorization: Bearer <accessToken de la clínica>" -H "Content-Type: application/json" \
  -d '{ "tipo": "Rabia", "lote": "RB-2291", "fechaAplicacion": "2026-10-07" }'
```

- Si no se envía `fechaVencimiento`, el API la calcula con la vigencia del
  [esquema de vacunación](./vacunacion.md).
- El nombre se compara sin tildes ni mayúsculas (`rabia` es `Rabia`) y se guarda el nombre
  oficial del catálogo.
- Con vencimiento conocido se agenda un recordatorio. Las desparasitaciones con `proximaFecha`
  también.

Una consulta registra quién la hizo: `clinicaId` es la clínica en nombre de la cual actúa el
usuario y `veterinarioId`, el usuario. Un tratamiento puede referir a una consulta
(`consultaId`), que tiene que ser de la misma mascota.

## Registrar el día a día

```bash
curl -X POST http://localhost:3001/api/mascotas/<mascotaId>/peso \
  -H "Authorization: Bearer <accessToken del dueño>" -H "Content-Type: application/json" \
  -d '{ "pesoKg": 18.6 }'
```

Sin `fecha`, toma la de hoy en Costa Rica.

## Leer el expediente

`GET /mascotas/<mascotaId>/expediente` devuelve cada tipo de registro ordenado del más reciente
al más antiguo (el peso, del más antiguo al más reciente, listo para graficar), más dos listas
para resolver nombres:

```json
{
  "clinicas": [{ "id": "…", "nombre": "Veterinaria San Isidro" }],
  "veterinarios": [{ "id": "…", "nombre": "Dra. Laura Mora" }],
  "consultas": [],
  "vacunas": [],
  "desparasitaciones": [],
  "tratamientos": [],
  "examenes": [],
  "registrosPeso": [],
  "registrosAlimentacion": []
}
```
