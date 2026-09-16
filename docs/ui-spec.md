# Especificación de interfaz — Vetify

> Documento en construcción. El sistema de diseño y el mapeo pantalla ↔ historia están
> planteados; lo marcado _(por llenar)_ se completa al implementar cada pantalla.
>
> **Referencia visual obligatoria:** `docs/diseno/mockups.html` (abrir en el navegador).
> Las capturas `screen1.png` … `screen9_web.png` son el mismo material para el informe.
> Las pantallas se implementan como **componentes reales**, nunca como imágenes incrustadas.

---

## 1. Principios

- **Móvil primero.** Se diseña a ancho de teléfono y se expande; el portal de clínica es la
  única vista pensada para escritorio.
- **El dueño manda.** Todo lo relativo a consentimiento se muestra explícito y reversible.
- **Nada que el API pueda negar.** Si la UI muestra algo que el servidor devolvería con `403`,
  la pantalla está mal planteada.
- **Español, con tildes correctas**, incluidos los mensajes de error.

## 2. Sistema de diseño

### Paleta

Definida como tokens en `apps/web/src/app/globals.css`.

| Token                           | Valor                 | Uso                                             |
| ------------------------------- | --------------------- | ----------------------------------------------- |
| `--color-vetify-verde`          | `#1B5540`             | Color de marca, encabezados, acciones primarias |
| `--color-vetify-verde-oscuro`   | `#124030`             | Estados presionados, texto sobre crema          |
| `--color-vetify-dorado`         | `#C2A05A`             | Acentos, destacados del carné                   |
| `--color-vetify-crema`          | `#FAF6EC`             | Fondo de la aplicación                          |
| `--background` / `--foreground` | `#FAF6EC` / `#1B3A2F` | Base de la página                               |

### Tipografía

| Rol   | Fuente                        | Uso                                |
| ----- | ----------------------------- | ---------------------------------- |
| Serif | **Fraunces** (`--font-serif`) | Títulos y nombres de mascota       |
| Sans  | Geist (`--font-sans`)         | Cuerpo, formularios, datos         |
| Mono  | Geist Mono (`--font-mono`)    | Identificadores, microchip, tokens |

### Componentes

Base de **shadcn/ui** ya instalada en `apps/web/src/components/ui/`: `button`, `card`, `input`,
`badge`, `tabs`, `avatar`, `switch`, `progress`, `dialog`, `skeleton`. Los componentes propios de
dominio viven en `apps/web/src/components/`.

### Estados obligatorios de cada pantalla

Ninguna pantalla se da por terminada sin los cuatro:

1. **Carga** — `skeleton`, nunca un spinner suelto.
2. **Error** — mensaje en español accionable, no el código HTTP crudo.
3. **Vacío** — con llamado a la acción.
4. **Offline** — es una PWA: lo ya cacheado se sigue viendo; una ruta nueva cae en
   `/sin-conexion`.

## 3. Mapa de rutas

| Ruta                        | Grupo       | Acceso                  | Pantalla del mockup           |
| --------------------------- | ----------- | ----------------------- | ----------------------------- |
| `/iniciar-sesion`           | `(auth)`    | Público                 | 1 · Registro / Ingreso        |
| `/registro`                 | `(auth)`    | Público                 | 1 · Registro / Ingreso        |
| `/mascotas`                 | `(dueno)`   | Dueño                   | 2 · Mis mascotas              |
| `/mascotas/[id]`            | `(dueno)`   | Dueño                   | 3 · Perfil de la mascota      |
| `/mascotas/[id]/expediente` | `(dueno)`   | Dueño                   | 4 · Expediente clínico        |
| `/mascotas/[id]/vacunas`    | `(dueno)`   | Dueño                   | 5 · Esquema de vacunación     |
| `/mascotas/[id]/carne`      | `(dueno)`   | Dueño                   | 6 · Carné digital (QR)        |
| `/mascotas/[id]/peso`       | `(dueno)`   | Dueño                   | 7 · Analítica de peso e IA    |
| `/mascotas/[id]/permisos`   | `(dueno)`   | Dueño                   | 8 · Permisos y consentimiento |
| `/pacientes`                | `(clinica)` | Clínica                 | 9 · Portal web de la clínica  |
| `/verificar/[token]`        | —           | **Público, sin sesión** | Verificación de carné         |
| `/sin-conexion`             | —           | Público                 | Respaldo del service worker   |

> Estado actual: las rutas de `(auth)`, `/mascotas`, `/pacientes`, `/verificar/[token]` y
> `/sin-conexion` existen como marcadores. El resto se crea al implementarlas.

## 4. Mapeo pantalla ↔ historia ↔ requerimiento

| #   | Pantalla                  | Historia            | Requerimiento       | Estado    |
| --- | ------------------------- | ------------------- | ------------------- | --------- |
| 1   | Registro / Ingreso        | HU-01, HU-02        | RF-01, RF-02        | Marcador  |
| 2   | Mis mascotas              | HU-05               | RF-05               | Marcador  |
| 3   | Perfil de la mascota      | HU-04               | RF-04               | Pendiente |
| 4   | Expediente clínico        | HU-06, HU-07, HU-08 | RF-06, RF-07, RF-08 | Pendiente |
| 5   | Esquema de vacunación     | HU-14               | RF-16               | Pendiente |
| 6   | Carné digital (QR)        | HU-12               | RF-12               | Pendiente |
| 7   | Analítica de peso e IA    | HU-16               | RF-18, RF-19        | Pendiente |
| 8   | Permisos y consentimiento | HU-09, HU-10, HU-11 | RF-09, RF-10, RF-11 | Pendiente |
| 9   | Portal de la clínica      | HU-06               | RF-06               | Marcador  |
| —   | Verificar carné           | HU-13               | RF-13               | Marcador  |

## 5. Detalle por pantalla

### 1 · Registro / Ingreso

Formulario con `react-hook-form` y los esquemas `registrarUsuarioSchema` e
`iniciarSesionSchema` de `@vetify/types`. El error de credenciales es genérico a propósito: no
debe revelar si el correo existe.
_(por llenar: disposición exacta y copys)_

### 2 · Mis mascotas

Listado en tarjetas con avatar, nombre en Fraunces, especie y raza. Vacío con llamado a
registrar la primera mascota.
_(por llenar)_

### 3 · Perfil de la mascota

_(por llenar)_

### 4 · Expediente clínico

Pestañas por tipo de registro. Lo que escribe la clínica y lo que escribe el dueño se distinguen
visualmente.
_(por llenar)_

### 5 · Esquema de vacunación

Vigencias con `badge` y `progress`. Estados: al día, por vencer, vencida.
_(por llenar)_

### 6 · Carné digital (QR)

El QR se arma con el token firmado que devuelve el API. **Nunca se construye en el cliente.**
_(por llenar)_

### 7 · Analítica de peso e IA

Recharts, curva de peso contra el rango esperado, con las anomalías del módulo de IA marcadas
visualmente y su severidad.
_(por llenar)_

### 8 · Permisos y consentimiento

Debe quedar clarísimo qué clínica ve qué, y permitir **revocar en un toque** con confirmación.
_(por llenar)_

### 9 · Portal de la clínica

Única vista pensada para escritorio. Solo pacientes con permiso activo.
_(por llenar)_

### Verificar carné (pública)

Sin sesión. Solo nombre, especie y vigencia de vacunas. Token vencido o alterado: mensaje claro
sin filtrar información.
_(por llenar)_

## 6. Accesibilidad

- Objetivos táctiles cómodos y contraste suficiente sobre el fondo crema.
- Etiquetas visibles en todos los campos, no solo `placeholder`.
- _(por llenar: verificación con lector de pantalla)_

## 7. Evidencia

Al terminar cada pantalla, tomar captura de la aplicación corriendo y guardarla en
`docs/diseno/` — es material directo para el avance y la defensa.
