# Historias de usuario — Vetify

> Documento en construcción. Las épicas y las historias principales están planteadas;
> los criterios de aceptación marcados _(por llenar)_ se completan por fase.

Formato: **Como** \<actor\>, **quiero** \<acción\>, **para** \<beneficio\>.
Cada historia se traza a un requerimiento de `docs/requerimientos.md` y a una pantalla de
`docs/ui-spec.md`.

---

## Épica 1 — Cuenta y sesión

### HU-01 · Registrarme como dueño

**Como** dueño de una mascota, **quiero** crear una cuenta con mi correo, **para** empezar el
expediente de mi animal.
_Trazabilidad:_ RF-01 · Pantalla: Registro

**Criterios de aceptación**

- Dado un correo no registrado y una contraseña de al menos 10 caracteres, cuando envío el
  formulario, entonces la cuenta se crea y quedo con la sesión iniciada.
- Dado un correo ya registrado, cuando envío el formulario, entonces veo un mensaje en español
  que lo indica y no se crea nada.

### HU-02 · Iniciar sesión

**Como** usuario registrado, **quiero** entrar con mi correo y contraseña, **para** acceder a
mis datos.
_Trazabilidad:_ RF-02 · Pantalla: Iniciar sesión

**Criterios de aceptación**

- Con credenciales válidas, accedo al área que corresponde a mi rol.
- Con credenciales inválidas, veo un mensaje genérico que no revela si el correo existe.
- Tras varios intentos fallidos seguidos, el sistema limita la tasa.

### HU-03 · Cerrar sesión

_(por llenar)_ · RF-03

---

## Épica 2 — Mis mascotas

### HU-04 · Registrar una mascota

**Como** dueño, **quiero** registrar a mi mascota con sus datos y foto, **para** tener su
expediente en un solo lugar.
_Trazabilidad:_ RF-04 · Pantalla: Nueva mascota

**Criterios de aceptación**

- Nombre y especie son obligatorios; el resto es opcional.
- Al guardar, la mascota aparece en el listado sin recargar la página.

### HU-05 · Ver mis mascotas

_(por llenar)_ · RF-05 · Pantalla: Mis mascotas

---

## Épica 3 — Expediente

### HU-06 · Registrar el acto médico

**Como** veterinario de una clínica autorizada, **quiero** registrar la consulta, las vacunas y
los tratamientos, **para** que queden en el expediente del animal.
_Trazabilidad:_ RF-06 · Pantalla: Expediente (portal de clínica)

**Criterios de aceptación**

- Sin un permiso activo del dueño sobre esa mascota, la operación devuelve `403`.
- Cada registro queda asociado a la clínica y al veterinario que lo hizo.
- El acceso queda en la bitácora.

### HU-07 · Registrar peso y alimentación

**Como** dueño, **quiero** anotar el peso de mi mascota, **para** llevar su evolución.
_Trazabilidad:_ RF-07 · Pantalla: Expediente (app del dueño)

### HU-08 · Ver el expediente consolidado

**Como** dueño, **quiero** ver todo el historial aunque lo hayan atendido en varias clínicas,
**para** no depender de ninguna.
_Trazabilidad:_ RF-08 · Pantalla: Expediente

---

## Épica 4 — Consentimiento (el diferenciador)

### HU-09 · Autorizar a una clínica

**Como** dueño, **quiero** dar acceso a una clínica, **para** que pueda atender a mi mascota con
el historial completo.
_Trazabilidad:_ RF-09 · Pantalla: Permisos

**Criterios de aceptación**

- Puedo elegir entre expediente completo y solo carné.
- La clínica ve la mascota inmediatamente después de otorgado el permiso.

### HU-10 · Revocar el acceso

**Como** dueño, **quiero** quitarle el acceso a una clínica en un toque, **para** mantener el
control de la información de mi mascota.
_Trazabilidad:_ RF-10 · Pantalla: Permisos

**Criterios de aceptación**

- La revocación se hace con una sola acción y pide confirmación.
- Tras revocar, cualquier petición de esa clínica sobre esa mascota devuelve `403`.
- El registro del permiso no se borra: queda con estado `revocado`.

### HU-11 · Ver quién consultó el expediente

_(por llenar)_ · RF-11 · Pantalla: Bitácora

---

## Épica 5 — Carné digital y verificación

### HU-12 · Mostrar el carné con QR

_(por llenar)_ · RF-12 · Pantalla: Carné

### HU-13 · Verificar vigencia desde afuera

**Como** encargado de una guardería, **quiero** escanear el QR, **para** confirmar que las
vacunas están al día sin ver datos privados.
_Trazabilidad:_ RF-13 · Pantalla: Verificar carné (pública)

**Criterios de aceptación**

- La página no exige sesión.
- Muestra únicamente nombre, especie y vigencia de vacunas.
- Un token vencido o alterado muestra un mensaje claro y no revela nada.

---

## Épica 6 — Prevención y recordatorios

### HU-14 · Saber qué vacuna toca

_(por llenar)_ · RF-16

### HU-15 · Recibir un recordatorio

_(por llenar)_ · RF-17

---

## Épica 7 — Análisis e IA

### HU-16 · Ver la curva de peso

_(por llenar)_ · RF-18, RF-19 · Pantalla: Gráfica de peso

### HU-17 · Resumen previo a la consulta

_(por llenar)_ · RF-20

---

## Pendientes de priorización

_(por llenar: estimación en puntos y asignación a los avances del curso)_
