---
sidebar_position: 3
title: Autorización y bitácora
---

# Autorización y bitácora

## Roles

| Rol       | Quién                                                                      |
| --------- | -------------------------------------------------------------------------- |
| `dueño`   | Posee el expediente de sus mascotas.                                       |
| `clinica` | Personal de una clínica; accede solo a mascotas cuyo dueño le dio permiso. |

## Un solo punto de decisión

Todo servicio que toca datos de una mascota llama primero a `PermisosService.autorizar`, con una
de cuatro operaciones:

| Operación                                                                    | Dueño de la mascota | Clínica con permiso activo |
| ---------------------------------------------------------------------------- | ------------------- | -------------------------- |
| `leer`: perfil, expediente, esquema                                          | ✓                   | ✓                          |
| `acto_medico`: consultas, vacunas, desparasitaciones, tratamientos, exámenes | —                   | ✓                          |
| `dia_a_dia`: peso y alimentación                                             | ✓                   | —                          |
| `administrar`: editar la mascota, permisos, bitácora                         | ✓                   | —                          |

Las respuestas cuando no se puede:

| Caso                                                              | Código |
| ----------------------------------------------------------------- | ------ |
| Clínica sin permiso activo y de alcance completo sobre la mascota | `403`  |
| Dueño que intenta registrar un acto médico                        | `403`  |
| Clínica que intenta registrar el día a día o administrar          | `403`  |
| Dueño que no es el de la mascota, o mascota que no existe         | `404`  |

El `404` es intencional: a quien no es el dueño no se le confirma que la mascota existe.

:::note
Ocultar un botón en la interfaz no es autorizar. La web solo evita mostrar lo que el API va a
negar; la decisión siempre la toma el API.
:::

## Permisos

El dueño otorga acceso por mascota y por clínica:

```bash
curl -X POST http://localhost:3001/api/mascotas/<mascotaId>/permisos \
  -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d '{ "clinicaId": "<clinicaId>", "alcance": "completo" }'
```

| Alcance      | Qué permite                                      |
| ------------ | ------------------------------------------------ |
| `completo`   | Leer el expediente y registrar el acto médico.   |
| `solo_carne` | Solo la vigencia de vacunas, a través del carné. |

`PATCH /mascotas/<mascotaId>/permisos/<permisoId>/revocar` corta el acceso en la **siguiente
petición**: los permisos no se cachean. Volver a otorgarlo reactiva el mismo registro.

## Bitácora

Un interceptor global escribe en `bitacora_accesos` **cada acceso exitoso** a una ruta con
`:mascotaId`. No depende de que cada endpoint se acuerde de hacerlo, y la respuesta no sale
hasta que la entrada se guardó. Las consultas de una clínica a `GET /avisos` también quedan
registradas, una entrada por paciente.

`GET /mascotas/<mascotaId>/bitacora` (solo el dueño) devuelve las últimas 200 entradas, con quién
hizo cada una:

| Acción                                                                                                             | Significa                                                 |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `ver_mascota`, `ver_expediente`, `ver_vacunacion`                                                                  | Lectura del perfil, el expediente o el esquema            |
| `ver_avisos`                                                                                                       | Una clínica revisó los esquemas vencidos de sus pacientes |
| `registrar_consulta`, `registrar_vacuna`, `registrar_desparasitacion`, `registrar_tratamiento`, `registrar_examen` | Acto médico                                               |
| `registrar_peso`, `registrar_alimentacion`                                                                         | Día a día del dueño                                       |
| `otorgar_permiso`, `revocar_permiso`, `ver_permisos`, `ver_bitacora`, `editar_mascota`                             | Administración del dueño                                  |
