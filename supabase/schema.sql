-- ============================================================================
-- Vetify — Esquema de base de datos (PostgreSQL / Supabase)
-- Fuente de verdad del modelo de datos. Aplica con: npx supabase db push
-- Seguridad: Row Level Security en todas las tablas del expediente.
-- ============================================================================

-- ---------- Tipos ----------
create type rol_usuario as enum ('dueño', 'clinica');
create type especie as enum ('perro', 'gato', 'otro');
create type sexo_animal as enum ('macho', 'hembra');
create type estado_permiso as enum ('activo', 'revocado', 'pendiente');
create type alcance_permiso as enum ('completo', 'solo_carne');
create type severidad as enum ('baja', 'media', 'alta');

-- ---------- Cuentas y roles ----------
-- Perfil ligado a auth.users de Supabase.
create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  correo      text unique not null,
  nombre      text not null,
  rol         rol_usuario not null default 'dueño',
  telefono    text,
  creado_en   timestamptz not null default now()
);

create table clinicas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  direccion             text,
  pais                  text not null default 'CR',
  plan                  text not null default 'piloto',
  cantidad_veterinarios int not null default 1,
  creado_en             timestamptz not null default now()
);

create table clinica_personal (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references clinicas(id) on delete cascade,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  cargo       text not null default 'veterinario',
  unique (clinica_id, usuario_id)
);

-- ---------- Expediente de la mascota ----------
create table mascotas (
  id                uuid primary key default gen_random_uuid(),
  dueño_id          uuid not null references usuarios(id) on delete cascade,
  nombre            text not null,
  especie           especie not null,
  raza              text,
  sexo              sexo_animal,
  fecha_nacimiento  date,
  esterilizado      boolean not null default false,
  microchip         text,
  foto_url          text,
  creado_en         timestamptz not null default now()
);

create table consultas (
  id              uuid primary key default gen_random_uuid(),
  mascota_id      uuid not null references mascotas(id) on delete cascade,
  clinica_id      uuid references clinicas(id),
  veterinario_id  uuid references usuarios(id),
  fecha           timestamptz not null default now(),
  motivo          text,
  diagnostico     text,
  notas           text
);

create table vacunas (
  id                 uuid primary key default gen_random_uuid(),
  mascota_id         uuid not null references mascotas(id) on delete cascade,
  tipo               text not null,
  lote               text,
  fecha_aplicacion   date not null,
  fecha_vencimiento  date,
  clinica_id         uuid references clinicas(id)
);

create table desparasitaciones (
  id            uuid primary key default gen_random_uuid(),
  mascota_id    uuid not null references mascotas(id) on delete cascade,
  producto      text,
  tipo          text,            -- interna / externa
  fecha         date not null,
  proxima_fecha date
);

create table tratamientos (
  id           uuid primary key default gen_random_uuid(),
  consulta_id  uuid references consultas(id) on delete cascade,
  mascota_id   uuid not null references mascotas(id) on delete cascade,
  descripcion  text not null,
  inicio       date,
  fin          date
);

create table examenes (
  id           uuid primary key default gen_random_uuid(),
  mascota_id   uuid not null references mascotas(id) on delete cascade,
  tipo         text,
  fecha        date not null,
  archivo_url  text,
  resultado    text
);

create table registros_peso (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references mascotas(id) on delete cascade,
  fecha       date not null default current_date,
  peso_kg     numeric(6,2) not null
);

create table registros_alimentacion (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references mascotas(id) on delete cascade,
  fecha       date not null default current_date,
  detalle     text
);

-- ---------- Reglas de negocio y seguridad ----------
-- Reglas del esquema preventivo por país / especie / edad.
create table esquemas_vacunacion (
  id                uuid primary key default gen_random_uuid(),
  pais              text not null,
  especie           especie not null,
  vacuna            text not null,
  edad_minima_meses int,
  intervalo_meses   int,          -- refuerzo
  vigencia_meses    int not null  -- cuánto dura la protección
);

-- Consentimiento dueño -> clínica (revocable). Base de la RLS del expediente.
create table permisos (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references mascotas(id) on delete cascade,
  clinica_id  uuid not null references clinicas(id) on delete cascade,
  alcance     alcance_permiso not null default 'completo',
  estado      estado_permiso not null default 'activo',
  creado_en   timestamptz not null default now(),
  unique (mascota_id, clinica_id)
);

-- Bitácora de cada acceso al expediente.
create table bitacora_accesos (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references mascotas(id) on delete cascade,
  usuario_id  uuid references usuarios(id),
  accion      text not null,
  fecha       timestamptz not null default now()
);

create table recordatorios (
  id             uuid primary key default gen_random_uuid(),
  mascota_id     uuid not null references mascotas(id) on delete cascade,
  tipo           text not null,   -- vacuna / desparasitación / peso
  fecha_objetivo date not null,
  canal          text not null default 'push',
  estado         text not null default 'pendiente'
);

create table anomalias (
  id          uuid primary key default gen_random_uuid(),
  mascota_id  uuid not null references mascotas(id) on delete cascade,
  tipo        text not null,       -- p.ej. 'peso'
  severidad   severidad not null default 'media',
  confianza   numeric(4,3),
  detalle     text,
  fecha       timestamptz not null default now()
);

-- ---------- Índices útiles ----------
create index on mascotas (dueño_id);
create index on consultas (mascota_id);
create index on vacunas (mascota_id);
create index on registros_peso (mascota_id, fecha);
create index on permisos (clinica_id, estado);

-- ============================================================================
-- Row Level Security (RLS)
-- Regla base: el dueño ve/gestiona sus mascotas; una clínica solo ve una
-- mascota si tiene un permiso ACTIVO. Se muestra el patrón para `mascotas`;
-- replicar el mismo enfoque (via mascota_id) en las tablas del expediente.
-- ============================================================================
alter table mascotas          enable row level security;
alter table consultas         enable row level security;
alter table vacunas           enable row level security;
alter table registros_peso    enable row level security;
alter table permisos          enable row level security;
alter table bitacora_accesos  enable row level security;
-- (habilitar RLS también en el resto de tablas del expediente)

-- Helper: ¿el usuario actual pertenece a una clínica con permiso activo?
create or replace function tiene_permiso(_mascota uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from permisos p
    join clinica_personal cp on cp.clinica_id = p.clinica_id
    where p.mascota_id = _mascota
      and p.estado = 'activo'
      and cp.usuario_id = auth.uid()
  );
$$;

-- El dueño gestiona sus mascotas.
create policy mascotas_dueño on mascotas
  for all using (dueño_id = auth.uid()) with check (dueño_id = auth.uid());

-- Una clínica con permiso activo puede leer la mascota.
create policy mascotas_clinica_lee on mascotas
  for select using (tiene_permiso(id));

-- Ejemplo para una tabla del expediente (consultas): dueño o clínica con permiso.
create policy consultas_acceso on consultas
  for select using (
    exists (select 1 from mascotas m where m.id = consultas.mascota_id and m.dueño_id = auth.uid())
    or tiene_permiso(consultas.mascota_id)
  );

-- NOTA: definir políticas equivalentes (select/insert/update) para vacunas,
-- desparasitaciones, tratamientos, examenes, registros_peso, etc., usando el
-- mismo criterio de dueño o `tiene_permiso(mascota_id)`.
