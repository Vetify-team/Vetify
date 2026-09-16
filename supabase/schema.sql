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
-- mascota si tiene un permiso ACTIVO en `permisos`.
--
-- El acto médico (consultas, vacunas, desparasitaciones, tratamientos,
-- examenes) lo escribe la clínica con permiso activo; el dueño solo lee.
-- El día a día (registros_peso, registros_alimentacion) lo escribe el dueño;
-- la clínica con permiso solo lee, para tener contexto en la consulta.
-- ============================================================================
alter table usuarios                 enable row level security;
alter table clinicas                 enable row level security;
alter table clinica_personal         enable row level security;
alter table mascotas                 enable row level security;
alter table consultas                enable row level security;
alter table vacunas                  enable row level security;
alter table desparasitaciones        enable row level security;
alter table tratamientos             enable row level security;
alter table examenes                 enable row level security;
alter table registros_peso           enable row level security;
alter table registros_alimentacion   enable row level security;
alter table esquemas_vacunacion      enable row level security;
alter table permisos                 enable row level security;
alter table bitacora_accesos         enable row level security;
alter table recordatorios            enable row level security;
alter table anomalias                enable row level security;

-- ---------- Helpers ----------

-- ¿El usuario actual es dueño de la mascota?
create or replace function es_dueño(_mascota uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from mascotas m
    where m.id = _mascota and m.dueño_id = auth.uid()
  );
$$;

-- ¿El usuario actual pertenece a una clínica con permiso ACTIVO sobre la mascota?
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

-- ¿El usuario actual pertenece al personal de esa clínica?
create or replace function es_personal_clinica(_clinica uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from clinica_personal cp
    where cp.clinica_id = _clinica and cp.usuario_id = auth.uid()
  );
$$;

-- ---------- Cuentas y roles ----------

-- Cada quien ve y edita únicamente su propia fila.
create policy usuarios_propio on usuarios
  for all using (id = auth.uid()) with check (id = auth.uid());

-- El nombre/dirección de una clínica es visible para cualquier autenticado
-- (se necesita para mostrar permisos y buscar clínica); solo su propio
-- personal la administra.
create policy clinicas_lee on clinicas
  for select using (auth.uid() is not null);

create policy clinicas_crea on clinicas
  for insert with check (auth.uid() is not null);

create policy clinicas_actualiza on clinicas
  for update using (es_personal_clinica(id)) with check (es_personal_clinica(id));

-- El personal de una clínica se ve entre sí; cualquiera puede vincularse a
-- sí mismo (p. ej. al crear la clínica o unirse a una existente).
create policy clinica_personal_lee on clinica_personal
  for select using (es_personal_clinica(clinica_id));

create policy clinica_personal_crea on clinica_personal
  for insert with check (usuario_id = auth.uid());

create policy clinica_personal_elimina on clinica_personal
  for delete using (usuario_id = auth.uid());

-- ---------- Expediente: mascotas ----------

create policy mascotas_dueño on mascotas
  for all using (dueño_id = auth.uid()) with check (dueño_id = auth.uid());

create policy mascotas_clinica_lee on mascotas
  for select using (tiene_permiso(id));

-- ---------- Expediente: acto médico (lo escribe la clínica) ----------

create policy consultas_lee on consultas
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy consultas_escribe_clinica on consultas
  for insert with check (tiene_permiso(mascota_id));
create policy consultas_actualiza_clinica on consultas
  for update using (tiene_permiso(mascota_id)) with check (tiene_permiso(mascota_id));

create policy vacunas_lee on vacunas
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy vacunas_escribe_clinica on vacunas
  for insert with check (tiene_permiso(mascota_id));
create policy vacunas_actualiza_clinica on vacunas
  for update using (tiene_permiso(mascota_id)) with check (tiene_permiso(mascota_id));

create policy desparasitaciones_lee on desparasitaciones
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy desparasitaciones_escribe_clinica on desparasitaciones
  for insert with check (tiene_permiso(mascota_id));
create policy desparasitaciones_actualiza_clinica on desparasitaciones
  for update using (tiene_permiso(mascota_id)) with check (tiene_permiso(mascota_id));

create policy tratamientos_lee on tratamientos
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy tratamientos_escribe_clinica on tratamientos
  for insert with check (tiene_permiso(mascota_id));
create policy tratamientos_actualiza_clinica on tratamientos
  for update using (tiene_permiso(mascota_id)) with check (tiene_permiso(mascota_id));

create policy examenes_lee on examenes
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy examenes_escribe_clinica on examenes
  for insert with check (tiene_permiso(mascota_id));
create policy examenes_actualiza_clinica on examenes
  for update using (tiene_permiso(mascota_id)) with check (tiene_permiso(mascota_id));

-- ---------- Expediente: día a día (lo escribe el dueño) ----------

create policy registros_peso_lee on registros_peso
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy registros_peso_escribe_dueño on registros_peso
  for insert with check (es_dueño(mascota_id));
create policy registros_peso_actualiza_dueño on registros_peso
  for update using (es_dueño(mascota_id)) with check (es_dueño(mascota_id));

create policy registros_alimentacion_lee on registros_alimentacion
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy registros_alimentacion_escribe_dueño on registros_alimentacion
  for insert with check (es_dueño(mascota_id));
create policy registros_alimentacion_actualiza_dueño on registros_alimentacion
  for update using (es_dueño(mascota_id)) with check (es_dueño(mascota_id));

-- ---------- Catálogo global (solo lectura) ----------
-- Se escribe únicamente con Admin/service_role (bypassa RLS), nunca desde el cliente.
create policy esquemas_vacunacion_lee on esquemas_vacunacion
  for select using (auth.uid() is not null);

-- ---------- Consentimiento y bitácora ----------

-- El dueño otorga y revoca permisos sobre sus propias mascotas.
create policy permisos_dueño on permisos
  for all using (es_dueño(mascota_id)) with check (es_dueño(mascota_id));

-- La clínica ve los permisos que la involucran (para saber a qué mascotas accede).
create policy permisos_clinica_lee on permisos
  for select using (es_personal_clinica(clinica_id));

-- La bitácora es inmutable: solo se lee (el dueño) y se inserta
-- (quien accede al expediente); nunca se actualiza ni se borra.
create policy bitacora_lee on bitacora_accesos
  for select using (es_dueño(mascota_id));
create policy bitacora_inserta on bitacora_accesos
  for insert with check (es_dueño(mascota_id) or tiene_permiso(mascota_id));

-- ---------- Recordatorios y anomalías (IA) ----------
-- Los genera el propio dueño o procesos de servidor (service_role, que
-- bypassa RLS); la clínica con permiso también puede consultarlos.

create policy recordatorios_lee on recordatorios
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
create policy recordatorios_gestiona_dueño on recordatorios
  for all using (es_dueño(mascota_id)) with check (es_dueño(mascota_id));

create policy anomalias_lee on anomalias
  for select using (es_dueño(mascota_id) or tiene_permiso(mascota_id));
