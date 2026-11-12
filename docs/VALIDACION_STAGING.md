# Validación funcional en staging (11 y 12 de noviembre de 2026)

Recorrido completo de Vetify en staging (`*.stg.vetify.live`), en el navegador y con correos
reales del equipo. No se tocó producción. Las cuentas de prueba siguen en staging; sus correos y
contraseñas no se guardan en el repo.

## Datos de prueba

| Rol             | Qué se creó                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Admin de Vetify | Una cuenta admin creada con `admin:create`                                                                    |
| Dueño           | Cuenta con el perro "Toby": foto, dos exámenes PDF de laboratorio externo, una observación y dos pesos        |
| Dueño 2         | Cuenta con la gata "Mía", para probar el asistente                                                            |
| Consultorio     | "Consultorio Veterinario San Pablo", plan Consultorio, alta con enlace del admin                              |
| Clínica         | "Clínica Veterinaria Montecillos", plan Clínica, alta con enlace; administrador y tres veterinarios invitados |

Archivos usados: hemograma, química sanguínea y ecografía en PDF generados para la prueba
(rotulados "documento de prueba"), y una foto de la mascota.

## Qué se comprobó

| Flujo                                                               | Resultado                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Registro de dueño, asistente de mascota y plan gratuito             | Correcto; correo de bienvenida recibido                                            |
| Foto de la mascota y exámenes con archivo (Cloudinary)              | Correcto; el enlace firmado de 5 minutos devuelve el mismo PDF, byte a byte        |
| Observaciones y serie de peso con gráfica                           | Correcto                                                                           |
| Enlaces de alta de clínicas desde el panel admin                    | Correcto; correo "Registrá … en Vetify" recibido                                   |
| Registro de consultorio y clínica con el enlace                     | Correcto; quedan en revisión y sin códigos                                         |
| Verificación por el admin                                           | Correcto; muestra fecha y admin (#53)                                              |
| Invitaciones al equipo y aceptación                                 | Correcto; correo recibido, el veterinario entra directo al portal y no ve "Equipo" |
| Código de vinculación y permiso "ver y escribir"                    | Correcto; la clínica ve todo lo cargado por el dueño                               |
| Consulta, vacuna, desparasitación y examen con PDF desde la clínica | Correcto; cada acto firmado con veterinario y clínica                              |
| Permiso "solo carné"                                                | Corregido en #55: la clínica ve el carné en Carnés y nada más                      |
| Bitácora del dueño                                                  | Correcto; todas las acciones en palabras desde #54 y #56                           |
| Redirección entre sitios con sesión de otro rol                     | Correcto desde #52 (antes, bucle hasta 429)                                        |

## Hallazgos y correcciones

| Hallazgo                                                                                                                                                                                                                                    | PR  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Una mascota nueva mostraba vacunas "Pendiente" sin registros                                                                                                                                                                                | #51 |
| Bucle de recargas con la sesión de otro sitio                                                                                                                                                                                               | #52 |
| La clínica no recibía aviso al ser verificada; no se guardaba quién verificó; el admin no se enteraba de clínicas nuevas                                                                                                                    | #53 |
| Fecha de consulta en UTC (aparecía el día siguiente); `request_upload` sin traducir; "Al día" sin vacunas; opción elegida poco visible en el asistente; "¿Está esterilizada?" a un macho; "1 registros"; inicial en vez de foto en el carné | #54 |
| El permiso "solo carné" no daba ningún acceso                                                                                                                                                                                               | #55 |
| `view_card` sin traducir en la bitácora                                                                                                                                                                                                     | #56 |

Todo se publicó en producción con el release #57 (12 de noviembre de 2026).

## Pendiente

- Correos que no se revisaron con captura: bienvenida en versión clínica, "… ya está verificada"
  y "Clínica por verificar".
- Producción: cargar `OWNER_APP_URL=https://app.vetify.live` en `vetify-api` y crear un admin con
  `admin:create` para poder verificar clínicas.
