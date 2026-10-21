-- Moves the data model to English without losing data: renames types, enum
-- values, tables, columns, keys and indexes, and translates stored codes
-- (defaults, staff position, deworming kind, audit actions, reminder kind).
-- Vaccine names ("Rabia", "Polivalente") are user-facing data and stay as they are.

-- Enums
ALTER TYPE "rol_usuario" RENAME TO "user_role";
ALTER TYPE "user_role" RENAME VALUE 'dueño' TO 'owner';
ALTER TYPE "user_role" RENAME VALUE 'clinica' TO 'clinic';
ALTER TYPE "especie" RENAME TO "species";
ALTER TYPE "species" RENAME VALUE 'perro' TO 'dog';
ALTER TYPE "species" RENAME VALUE 'gato' TO 'cat';
ALTER TYPE "species" RENAME VALUE 'otro' TO 'other';
ALTER TYPE "sexo_animal" RENAME TO "animal_sex";
ALTER TYPE "animal_sex" RENAME VALUE 'macho' TO 'male';
ALTER TYPE "animal_sex" RENAME VALUE 'hembra' TO 'female';
ALTER TYPE "estado_permiso" RENAME TO "permission_status";
ALTER TYPE "permission_status" RENAME VALUE 'activo' TO 'active';
ALTER TYPE "permission_status" RENAME VALUE 'revocado' TO 'revoked';
ALTER TYPE "permission_status" RENAME VALUE 'pendiente' TO 'pending';
ALTER TYPE "alcance_permiso" RENAME TO "permission_scope";
ALTER TYPE "permission_scope" RENAME VALUE 'completo' TO 'full';
ALTER TYPE "permission_scope" RENAME VALUE 'solo_carne' TO 'card_only';
ALTER TYPE "severidad" RENAME TO "severity";
ALTER TYPE "severity" RENAME VALUE 'baja' TO 'low';
ALTER TYPE "severity" RENAME VALUE 'media' TO 'medium';
ALTER TYPE "severity" RENAME VALUE 'alta' TO 'high';

-- Tables and columns
ALTER TABLE "usuarios" RENAME TO "users";
ALTER TABLE "users" RENAME COLUMN "correo" TO "email";
ALTER TABLE "users" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "users" RENAME COLUMN "contrasena_hash" TO "password_hash";
ALTER TABLE "users" RENAME COLUMN "rol" TO "role";
ALTER TABLE "users" RENAME COLUMN "telefono" TO "phone";
ALTER TABLE "users" RENAME COLUMN "creado_en" TO "created_at";
ALTER TABLE "sesiones_refresco" RENAME TO "refresh_sessions";
ALTER TABLE "refresh_sessions" RENAME COLUMN "usuario_id" TO "user_id";
ALTER TABLE "refresh_sessions" RENAME COLUMN "expira_en" TO "expires_at";
ALTER TABLE "refresh_sessions" RENAME COLUMN "revocado_en" TO "revoked_at";
ALTER TABLE "refresh_sessions" RENAME COLUMN "creado_en" TO "created_at";
ALTER TABLE "clinicas" RENAME TO "clinics";
ALTER TABLE "clinics" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "clinics" RENAME COLUMN "direccion" TO "address";
ALTER TABLE "clinics" RENAME COLUMN "pais" TO "country";
ALTER TABLE "clinics" RENAME COLUMN "cantidad_veterinarios" TO "vet_count";
ALTER TABLE "clinics" RENAME COLUMN "creado_en" TO "created_at";
ALTER TABLE "clinica_personal" RENAME TO "clinic_staff";
ALTER TABLE "clinic_staff" RENAME COLUMN "clinica_id" TO "clinic_id";
ALTER TABLE "clinic_staff" RENAME COLUMN "usuario_id" TO "user_id";
ALTER TABLE "clinic_staff" RENAME COLUMN "cargo" TO "position";
ALTER TABLE "mascotas" RENAME TO "pets";
ALTER TABLE "pets" RENAME COLUMN "dueño_id" TO "owner_id";
ALTER TABLE "pets" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "pets" RENAME COLUMN "especie" TO "species";
ALTER TABLE "pets" RENAME COLUMN "raza" TO "breed";
ALTER TABLE "pets" RENAME COLUMN "sexo" TO "sex";
ALTER TABLE "pets" RENAME COLUMN "fecha_nacimiento" TO "birth_date";
ALTER TABLE "pets" RENAME COLUMN "esterilizado" TO "neutered";
ALTER TABLE "pets" RENAME COLUMN "foto_url" TO "photo_url";
ALTER TABLE "pets" RENAME COLUMN "creado_en" TO "created_at";
ALTER TABLE "consultas" RENAME TO "consultations";
ALTER TABLE "consultations" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "consultations" RENAME COLUMN "clinica_id" TO "clinic_id";
ALTER TABLE "consultations" RENAME COLUMN "veterinario_id" TO "veterinarian_id";
ALTER TABLE "consultations" RENAME COLUMN "fecha" TO "date";
ALTER TABLE "consultations" RENAME COLUMN "motivo" TO "reason";
ALTER TABLE "consultations" RENAME COLUMN "diagnostico" TO "diagnosis";
ALTER TABLE "consultations" RENAME COLUMN "notas" TO "notes";
ALTER TABLE "vacunas" RENAME TO "vaccinations";
ALTER TABLE "vaccinations" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "vaccinations" RENAME COLUMN "tipo" TO "vaccine";
ALTER TABLE "vaccinations" RENAME COLUMN "lote" TO "batch";
ALTER TABLE "vaccinations" RENAME COLUMN "fecha_aplicacion" TO "applied_on";
ALTER TABLE "vaccinations" RENAME COLUMN "fecha_vencimiento" TO "expires_on";
ALTER TABLE "vaccinations" RENAME COLUMN "clinica_id" TO "clinic_id";
ALTER TABLE "desparasitaciones" RENAME TO "dewormings";
ALTER TABLE "dewormings" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "dewormings" RENAME COLUMN "producto" TO "product";
ALTER TABLE "dewormings" RENAME COLUMN "tipo" TO "kind";
ALTER TABLE "dewormings" RENAME COLUMN "fecha" TO "applied_on";
ALTER TABLE "dewormings" RENAME COLUMN "proxima_fecha" TO "next_due_on";
ALTER TABLE "tratamientos" RENAME TO "treatments";
ALTER TABLE "treatments" RENAME COLUMN "consulta_id" TO "consultation_id";
ALTER TABLE "treatments" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "treatments" RENAME COLUMN "descripcion" TO "description";
ALTER TABLE "treatments" RENAME COLUMN "inicio" TO "starts_on";
ALTER TABLE "treatments" RENAME COLUMN "fin" TO "ends_on";
ALTER TABLE "examenes" RENAME TO "exams";
ALTER TABLE "exams" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "exams" RENAME COLUMN "tipo" TO "kind";
ALTER TABLE "exams" RENAME COLUMN "fecha" TO "performed_on";
ALTER TABLE "exams" RENAME COLUMN "archivo_url" TO "file_url";
ALTER TABLE "exams" RENAME COLUMN "resultado" TO "result";
ALTER TABLE "registros_peso" RENAME TO "weight_entries";
ALTER TABLE "weight_entries" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "weight_entries" RENAME COLUMN "fecha" TO "recorded_on";
ALTER TABLE "weight_entries" RENAME COLUMN "peso_kg" TO "weight_kg";
ALTER TABLE "registros_alimentacion" RENAME TO "feeding_entries";
ALTER TABLE "feeding_entries" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "feeding_entries" RENAME COLUMN "fecha" TO "recorded_on";
ALTER TABLE "feeding_entries" RENAME COLUMN "detalle" TO "notes";
ALTER TABLE "esquemas_vacunacion" RENAME TO "vaccination_rules";
ALTER TABLE "vaccination_rules" RENAME COLUMN "pais" TO "country";
ALTER TABLE "vaccination_rules" RENAME COLUMN "especie" TO "species";
ALTER TABLE "vaccination_rules" RENAME COLUMN "vacuna" TO "vaccine";
ALTER TABLE "vaccination_rules" RENAME COLUMN "edad_minima_meses" TO "min_age_months";
ALTER TABLE "vaccination_rules" RENAME COLUMN "intervalo_meses" TO "booster_interval_months";
ALTER TABLE "vaccination_rules" RENAME COLUMN "vigencia_meses" TO "validity_months";
ALTER TABLE "permisos" RENAME TO "permissions";
ALTER TABLE "permissions" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "permissions" RENAME COLUMN "clinica_id" TO "clinic_id";
ALTER TABLE "permissions" RENAME COLUMN "alcance" TO "scope";
ALTER TABLE "permissions" RENAME COLUMN "estado" TO "status";
ALTER TABLE "permissions" RENAME COLUMN "creado_en" TO "created_at";
ALTER TABLE "bitacora_accesos" RENAME TO "access_logs";
ALTER TABLE "access_logs" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "access_logs" RENAME COLUMN "usuario_id" TO "user_id";
ALTER TABLE "access_logs" RENAME COLUMN "accion" TO "action";
ALTER TABLE "access_logs" RENAME COLUMN "fecha" TO "occurred_at";
ALTER TABLE "recordatorios" RENAME TO "reminders";
ALTER TABLE "reminders" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "reminders" RENAME COLUMN "tipo" TO "kind";
ALTER TABLE "reminders" RENAME COLUMN "fecha_objetivo" TO "due_on";
ALTER TABLE "reminders" RENAME COLUMN "canal" TO "channel";
ALTER TABLE "reminders" RENAME COLUMN "estado" TO "status";
ALTER TABLE "anomalias" RENAME TO "anomalies";
ALTER TABLE "anomalies" RENAME COLUMN "mascota_id" TO "pet_id";
ALTER TABLE "anomalies" RENAME COLUMN "tipo" TO "kind";
ALTER TABLE "anomalies" RENAME COLUMN "severidad" TO "severity";
ALTER TABLE "anomalies" RENAME COLUMN "confianza" TO "confidence";
ALTER TABLE "anomalies" RENAME COLUMN "detalle" TO "details";
ALTER TABLE "anomalies" RENAME COLUMN "fecha" TO "detected_at";

-- Primary keys
ALTER TABLE "users" RENAME CONSTRAINT "usuarios_pkey" TO "users_pkey";
ALTER TABLE "refresh_sessions" RENAME CONSTRAINT "sesiones_refresco_pkey" TO "refresh_sessions_pkey";
ALTER TABLE "clinics" RENAME CONSTRAINT "clinicas_pkey" TO "clinics_pkey";
ALTER TABLE "clinic_staff" RENAME CONSTRAINT "clinica_personal_pkey" TO "clinic_staff_pkey";
ALTER TABLE "pets" RENAME CONSTRAINT "mascotas_pkey" TO "pets_pkey";
ALTER TABLE "consultations" RENAME CONSTRAINT "consultas_pkey" TO "consultations_pkey";
ALTER TABLE "vaccinations" RENAME CONSTRAINT "vacunas_pkey" TO "vaccinations_pkey";
ALTER TABLE "dewormings" RENAME CONSTRAINT "desparasitaciones_pkey" TO "dewormings_pkey";
ALTER TABLE "treatments" RENAME CONSTRAINT "tratamientos_pkey" TO "treatments_pkey";
ALTER TABLE "exams" RENAME CONSTRAINT "examenes_pkey" TO "exams_pkey";
ALTER TABLE "weight_entries" RENAME CONSTRAINT "registros_peso_pkey" TO "weight_entries_pkey";
ALTER TABLE "feeding_entries" RENAME CONSTRAINT "registros_alimentacion_pkey" TO "feeding_entries_pkey";
ALTER TABLE "vaccination_rules" RENAME CONSTRAINT "esquemas_vacunacion_pkey" TO "vaccination_rules_pkey";
ALTER TABLE "permissions" RENAME CONSTRAINT "permisos_pkey" TO "permissions_pkey";
ALTER TABLE "access_logs" RENAME CONSTRAINT "bitacora_accesos_pkey" TO "access_logs_pkey";
ALTER TABLE "reminders" RENAME CONSTRAINT "recordatorios_pkey" TO "reminders_pkey";
ALTER TABLE "anomalies" RENAME CONSTRAINT "anomalias_pkey" TO "anomalies_pkey";

-- Foreign keys
ALTER TABLE "refresh_sessions" RENAME CONSTRAINT "sesiones_refresco_usuario_id_fkey" TO "refresh_sessions_user_id_fkey";
ALTER TABLE "clinic_staff" RENAME CONSTRAINT "clinica_personal_clinica_id_fkey" TO "clinic_staff_clinic_id_fkey";
ALTER TABLE "clinic_staff" RENAME CONSTRAINT "clinica_personal_usuario_id_fkey" TO "clinic_staff_user_id_fkey";
ALTER TABLE "pets" RENAME CONSTRAINT "mascotas_dueño_id_fkey" TO "pets_owner_id_fkey";
ALTER TABLE "consultations" RENAME CONSTRAINT "consultas_mascota_id_fkey" TO "consultations_pet_id_fkey";
ALTER TABLE "consultations" RENAME CONSTRAINT "consultas_clinica_id_fkey" TO "consultations_clinic_id_fkey";
ALTER TABLE "consultations" RENAME CONSTRAINT "consultas_veterinario_id_fkey" TO "consultations_veterinarian_id_fkey";
ALTER TABLE "vaccinations" RENAME CONSTRAINT "vacunas_mascota_id_fkey" TO "vaccinations_pet_id_fkey";
ALTER TABLE "vaccinations" RENAME CONSTRAINT "vacunas_clinica_id_fkey" TO "vaccinations_clinic_id_fkey";
ALTER TABLE "dewormings" RENAME CONSTRAINT "desparasitaciones_mascota_id_fkey" TO "dewormings_pet_id_fkey";
ALTER TABLE "treatments" RENAME CONSTRAINT "tratamientos_consulta_id_fkey" TO "treatments_consultation_id_fkey";
ALTER TABLE "treatments" RENAME CONSTRAINT "tratamientos_mascota_id_fkey" TO "treatments_pet_id_fkey";
ALTER TABLE "exams" RENAME CONSTRAINT "examenes_mascota_id_fkey" TO "exams_pet_id_fkey";
ALTER TABLE "weight_entries" RENAME CONSTRAINT "registros_peso_mascota_id_fkey" TO "weight_entries_pet_id_fkey";
ALTER TABLE "feeding_entries" RENAME CONSTRAINT "registros_alimentacion_mascota_id_fkey" TO "feeding_entries_pet_id_fkey";
ALTER TABLE "permissions" RENAME CONSTRAINT "permisos_mascota_id_fkey" TO "permissions_pet_id_fkey";
ALTER TABLE "permissions" RENAME CONSTRAINT "permisos_clinica_id_fkey" TO "permissions_clinic_id_fkey";
ALTER TABLE "access_logs" RENAME CONSTRAINT "bitacora_accesos_mascota_id_fkey" TO "access_logs_pet_id_fkey";
ALTER TABLE "access_logs" RENAME CONSTRAINT "bitacora_accesos_usuario_id_fkey" TO "access_logs_user_id_fkey";
ALTER TABLE "reminders" RENAME CONSTRAINT "recordatorios_mascota_id_fkey" TO "reminders_pet_id_fkey";
ALTER TABLE "anomalies" RENAME CONSTRAINT "anomalias_mascota_id_fkey" TO "anomalies_pet_id_fkey";

-- Indexes
ALTER INDEX "usuarios_correo_key" RENAME TO "users_email_key";
ALTER INDEX "sesiones_refresco_usuario_id_idx" RENAME TO "refresh_sessions_user_id_idx";
ALTER INDEX "clinica_personal_clinica_id_usuario_id_key" RENAME TO "clinic_staff_clinic_id_user_id_key";
ALTER INDEX "mascotas_dueño_id_idx" RENAME TO "pets_owner_id_idx";
ALTER INDEX "consultas_mascota_id_idx" RENAME TO "consultations_pet_id_idx";
ALTER INDEX "vacunas_mascota_id_idx" RENAME TO "vaccinations_pet_id_idx";
ALTER INDEX "desparasitaciones_mascota_id_idx" RENAME TO "dewormings_pet_id_idx";
ALTER INDEX "tratamientos_mascota_id_idx" RENAME TO "treatments_pet_id_idx";
ALTER INDEX "examenes_mascota_id_idx" RENAME TO "exams_pet_id_idx";
ALTER INDEX "registros_peso_mascota_id_fecha_idx" RENAME TO "weight_entries_pet_id_recorded_on_idx";
ALTER INDEX "registros_alimentacion_mascota_id_idx" RENAME TO "feeding_entries_pet_id_idx";
ALTER INDEX "esquemas_vacunacion_pais_especie_idx" RENAME TO "vaccination_rules_country_species_idx";
ALTER INDEX "permisos_clinica_id_estado_idx" RENAME TO "permissions_clinic_id_status_idx";
ALTER INDEX "permisos_mascota_id_clinica_id_key" RENAME TO "permissions_pet_id_clinic_id_key";
ALTER INDEX "bitacora_accesos_mascota_id_fecha_idx" RENAME TO "access_logs_pet_id_occurred_at_idx";
ALTER INDEX "recordatorios_mascota_id_estado_idx" RENAME TO "reminders_pet_id_status_idx";
ALTER INDEX "anomalias_mascota_id_idx" RENAME TO "anomalies_pet_id_idx";

-- Defaults that were Spanish codes
ALTER TABLE "clinics" ALTER COLUMN "plan" SET DEFAULT 'pilot';
ALTER TABLE "clinic_staff" ALTER COLUMN "position" SET DEFAULT 'veterinarian';
ALTER TABLE "reminders" ALTER COLUMN "status" SET DEFAULT 'pending';

-- Stored codes
UPDATE "clinics" SET "plan" = 'pilot' WHERE "plan" = 'piloto';
UPDATE "clinic_staff" SET "position" = CASE "position"
  WHEN 'veterinario' THEN 'veterinarian' WHEN 'administrador' THEN 'admin' ELSE "position" END;
UPDATE "dewormings" SET "kind" = CASE "kind"
  WHEN 'interna' THEN 'internal' WHEN 'externa' THEN 'external' ELSE "kind" END;
UPDATE "reminders" SET "kind" = CASE "kind"
  WHEN 'vacuna' THEN 'vaccination' WHEN 'desparasitacion' THEN 'deworming' WHEN 'peso' THEN 'weight' ELSE "kind" END;
UPDATE "reminders" SET "status" = 'pending' WHERE "status" = 'pendiente';
UPDATE "anomalies" SET "kind" = 'weight' WHERE "kind" = 'peso';
UPDATE "access_logs" SET "action" = CASE "action"
  WHEN 'ver_mascota' THEN 'view_pet'
  WHEN 'ver_expediente' THEN 'view_record'
  WHEN 'ver_vacunacion' THEN 'view_vaccination'
  WHEN 'ver_avisos' THEN 'view_alerts'
  WHEN 'ver_permisos' THEN 'view_permissions'
  WHEN 'ver_bitacora' THEN 'view_access_log'
  WHEN 'editar_mascota' THEN 'update_pet'
  WHEN 'otorgar_permiso' THEN 'grant_permission'
  WHEN 'revocar_permiso' THEN 'revoke_permission'
  WHEN 'registrar_consulta' THEN 'record_consultation'
  WHEN 'registrar_vacuna' THEN 'record_vaccination'
  WHEN 'registrar_desparasitacion' THEN 'record_deworming'
  WHEN 'registrar_tratamiento' THEN 'record_treatment'
  WHEN 'registrar_examen' THEN 'record_exam'
  WHEN 'registrar_peso' THEN 'record_weight'
  WHEN 'registrar_alimentacion' THEN 'record_feeding'
  ELSE "action" END;
