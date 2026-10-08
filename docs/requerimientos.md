# Requerimientos — Vetify

> Documento en construcción. La estructura está puesta; las secciones marcadas con
> _(por llenar)_ se completan antes del avance correspondiente.

## 1. Alcance

Expediente clínico compartido para mascotas, propiedad del **dueño**, alimentado por el dueño y
por las clínicas veterinarias que él autorice. Único, portátil y vitalicio.

## 2. Actores

| Actor                          | Descripción                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| Dueño                          | Posee el expediente. Registra el día a día y otorga o revoca permisos. |
| Clínica (personal veterinario) | Registra el acto médico. Accede solo con permiso activo.               |
| Verificador                    | Tercero (hospedaje, guardería, aerolínea) que escanea el QR del carné. |

## 3. Requerimientos funcionales

Identificador `RF-nn`. Cada uno se trazará a una historia de usuario en
`docs/historias_usuario.md` y a una pantalla en `docs/ui-spec.md`.

### 3.1 Cuenta y sesión

| ID    | Requerimiento                                                      | Prioridad | Estado |
| ----- | ------------------------------------------------------------------ | --------- | ------ |
| RF-01 | El sistema permite registrarse como dueño o como clínica.          | Alta      | Hecho  |
| RF-02 | El sistema autentica con correo y contraseña y mantiene la sesión. | Alta      | Hecho  |
| RF-03 | El sistema permite cerrar sesión e invalidar el refresh token.     | Alta      | Hecho  |

### 3.2 Mascotas

| ID    | Requerimiento                                                                      | Prioridad | Estado |
| ----- | ---------------------------------------------------------------------------------- | --------- | ------ |
| RF-04 | El dueño registra una mascota con especie, raza, sexo, fecha de nacimiento y foto. | Alta      | Hecho  |
| RF-05 | El dueño consulta y edita los datos de sus mascotas.                               | Alta      | Hecho  |

### 3.3 Expediente

| ID    | Requerimiento                                                                                          | Prioridad | Estado |
| ----- | ------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-06 | La clínica con permiso activo registra consultas, vacunas, desparasitaciones, tratamientos y exámenes. | Alta      | Hecho  |
| RF-07 | El dueño registra peso y alimentación.                                                                 | Alta      | Hecho  |
| RF-08 | Ambos consultan el expediente consolidado, sin importar qué clínica lo alimentó.                       | Alta      | Hecho  |

### 3.4 Consentimiento

| ID    | Requerimiento                                                             | Prioridad | Estado |
| ----- | ------------------------------------------------------------------------- | --------- | ------ |
| RF-09 | El dueño otorga permiso a una clínica, con alcance completo o solo carné. | Alta      | Hecho  |
| RF-10 | El dueño revoca un permiso y el acceso se corta de inmediato.             | Alta      | Hecho  |
| RF-11 | El dueño consulta la bitácora de accesos a cada expediente.               | Media     | Hecho  |

### 3.5 Salidas

| ID    | Requerimiento                                                         | Prioridad | Estado    |
| ----- | --------------------------------------------------------------------- | --------- | --------- |
| RF-12 | El sistema genera un carné digital con QR verificable.                | Alta      | Pendiente |
| RF-13 | El verificador consulta la vigencia de vacunas sin ver el expediente. | Alta      | Pendiente |
| RF-14 | El sistema exporta el expediente a PDF.                               | Media     | Pendiente |
| RF-15 | El sistema exporta recordatorios a calendario (ICS).                  | Baja      | Parcial   |

### 3.6 Proceso y recordatorios

| ID    | Requerimiento                                                         | Prioridad | Estado  |
| ----- | --------------------------------------------------------------------- | --------- | ------- |
| RF-16 | El sistema calcula el esquema de vacunación por país, especie y edad. | Alta      | Hecho   |
| RF-17 | El sistema controla vigencias y notifica por push.                    | Media     | Parcial |

### 3.7 Análisis e IA

| ID    | Requerimiento                                                   | Prioridad | Estado    |
| ----- | --------------------------------------------------------------- | --------- | --------- |
| RF-18 | El sistema grafica la curva de peso contra el rango esperado.   | Media     | Parcial   |
| RF-19 | El sistema detecta anomalías de peso y las marca en la gráfica. | Media     | Pendiente |
| RF-20 | El sistema genera un resumen previo a la consulta.              | Baja      | Pendiente |

## 4. Requerimientos no funcionales

| ID     | Categoría      | Requerimiento                                                              |
| ------ | -------------- | -------------------------------------------------------------------------- |
| RNF-01 | Seguridad      | Todo el tráfico va por HTTPS/TLS.                                          |
| RNF-02 | Seguridad      | Las contraseñas se almacenan con argon2.                                   |
| RNF-03 | Seguridad      | La autorización se aplica en el API, nunca solo en la UI.                  |
| RNF-04 | Seguridad      | Todo acceso al expediente queda en `bitacora_accesos`.                     |
| RNF-05 | Seguridad      | Login, registro y verificación de QR tienen límite de tasa.                |
| RNF-06 | Privacidad     | La ruta pública de verificación expone solo vigencia de vacunas.           |
| RNF-07 | Disponibilidad | La PWA sigue mostrando los datos ya cacheados sin conexión.                |
| RNF-08 | Usabilidad     | Interfaz en español, diseñada primero a ancho de teléfono.                 |
| RNF-09 | Accesibilidad  | Contraste suficiente, etiquetas en los campos, objetivos táctiles cómodos. |
| RNF-10 | Mantenibilidad | Un tipo de dominio se define una sola vez, en `packages/types`.            |
| RNF-11 | Portabilidad   | La PWA es instalable en Android, iOS y escritorio.                         |
| RNF-12 | Rendimiento    | _(por llenar: definir el objetivo de tiempo de carga)_                     |

## 5. Restricciones

- Proyecto de curso con fechas fijas: II Avance 9 oct 2026, final 13 nov 2026.
- Equipo de dos personas.
- Infraestructura en capas gratuitas: Vercel, Render y Neon.

## 6. Supuestos

_(por llenar)_

## 7. Fuera de alcance

_(por llenar: facturación, agenda de citas de la clínica, telemedicina)_
