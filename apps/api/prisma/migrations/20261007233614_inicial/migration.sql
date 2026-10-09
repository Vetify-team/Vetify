-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('dueño', 'clinica');

-- CreateEnum
CREATE TYPE "especie" AS ENUM ('perro', 'gato', 'otro');

-- CreateEnum
CREATE TYPE "sexo_animal" AS ENUM ('macho', 'hembra');

-- CreateEnum
CREATE TYPE "estado_permiso" AS ENUM ('activo', 'revocado', 'pendiente');

-- CreateEnum
CREATE TYPE "alcance_permiso" AS ENUM ('completo', 'solo_carne');

-- CreateEnum
CREATE TYPE "severidad" AS ENUM ('baja', 'media', 'alta');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "correo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contrasena_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'dueño',
    "telefono" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_refresco" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_refresco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinicas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'CR',
    "plan" TEXT NOT NULL DEFAULT 'piloto',
    "cantidad_veterinarios" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinica_personal" (
    "id" UUID NOT NULL,
    "clinica_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cargo" TEXT NOT NULL DEFAULT 'veterinario',

    CONSTRAINT "clinica_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascotas" (
    "id" UUID NOT NULL,
    "dueño_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "especie" "especie" NOT NULL,
    "raza" TEXT,
    "sexo" "sexo_animal",
    "fecha_nacimiento" DATE,
    "esterilizado" BOOLEAN NOT NULL DEFAULT false,
    "microchip" TEXT,
    "foto_url" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mascotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "clinica_id" UUID,
    "veterinario_id" UUID,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "diagnostico" TEXT,
    "notas" TEXT,

    CONSTRAINT "consultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacunas" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "lote" TEXT,
    "fecha_aplicacion" DATE NOT NULL,
    "fecha_vencimiento" DATE,
    "clinica_id" UUID,

    CONSTRAINT "vacunas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desparasitaciones" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "producto" TEXT,
    "tipo" TEXT,
    "fecha" DATE NOT NULL,
    "proxima_fecha" DATE,

    CONSTRAINT "desparasitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tratamientos" (
    "id" UUID NOT NULL,
    "consulta_id" UUID,
    "mascota_id" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "inicio" DATE,
    "fin" DATE,

    CONSTRAINT "tratamientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "examenes" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "tipo" TEXT,
    "fecha" DATE NOT NULL,
    "archivo_url" TEXT,
    "resultado" TEXT,

    CONSTRAINT "examenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_peso" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso_kg" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "registros_peso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_alimentacion" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalle" TEXT,

    CONSTRAINT "registros_alimentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esquemas_vacunacion" (
    "id" UUID NOT NULL,
    "pais" TEXT NOT NULL,
    "especie" "especie" NOT NULL,
    "vacuna" TEXT NOT NULL,
    "edad_minima_meses" INTEGER,
    "intervalo_meses" INTEGER,
    "vigencia_meses" INTEGER NOT NULL,

    CONSTRAINT "esquemas_vacunacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "clinica_id" UUID NOT NULL,
    "alcance" "alcance_permiso" NOT NULL DEFAULT 'completo',
    "estado" "estado_permiso" NOT NULL DEFAULT 'activo',
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora_accesos" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "usuario_id" UUID,
    "accion" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_accesos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordatorios" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha_objetivo" DATE NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'push',
    "estado" TEXT NOT NULL DEFAULT 'pendiente',

    CONSTRAINT "recordatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomalias" (
    "id" UUID NOT NULL,
    "mascota_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "severidad" "severidad" NOT NULL DEFAULT 'media',
    "confianza" DECIMAL(4,3),
    "detalle" TEXT,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomalias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "sesiones_refresco_usuario_id_idx" ON "sesiones_refresco"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinica_personal_clinica_id_usuario_id_key" ON "clinica_personal"("clinica_id", "usuario_id");

-- CreateIndex
CREATE INDEX "mascotas_dueño_id_idx" ON "mascotas"("dueño_id");

-- CreateIndex
CREATE INDEX "consultas_mascota_id_idx" ON "consultas"("mascota_id");

-- CreateIndex
CREATE INDEX "vacunas_mascota_id_idx" ON "vacunas"("mascota_id");

-- CreateIndex
CREATE INDEX "desparasitaciones_mascota_id_idx" ON "desparasitaciones"("mascota_id");

-- CreateIndex
CREATE INDEX "tratamientos_mascota_id_idx" ON "tratamientos"("mascota_id");

-- CreateIndex
CREATE INDEX "examenes_mascota_id_idx" ON "examenes"("mascota_id");

-- CreateIndex
CREATE INDEX "registros_peso_mascota_id_fecha_idx" ON "registros_peso"("mascota_id", "fecha");

-- CreateIndex
CREATE INDEX "registros_alimentacion_mascota_id_idx" ON "registros_alimentacion"("mascota_id");

-- CreateIndex
CREATE INDEX "esquemas_vacunacion_pais_especie_idx" ON "esquemas_vacunacion"("pais", "especie");

-- CreateIndex
CREATE INDEX "permisos_clinica_id_estado_idx" ON "permisos"("clinica_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_mascota_id_clinica_id_key" ON "permisos"("mascota_id", "clinica_id");

-- CreateIndex
CREATE INDEX "bitacora_accesos_mascota_id_fecha_idx" ON "bitacora_accesos"("mascota_id", "fecha");

-- CreateIndex
CREATE INDEX "recordatorios_mascota_id_estado_idx" ON "recordatorios"("mascota_id", "estado");

-- CreateIndex
CREATE INDEX "anomalias_mascota_id_idx" ON "anomalias"("mascota_id");

-- AddForeignKey
ALTER TABLE "sesiones_refresco" ADD CONSTRAINT "sesiones_refresco_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinica_personal" ADD CONSTRAINT "clinica_personal_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinica_personal" ADD CONSTRAINT "clinica_personal_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascotas" ADD CONSTRAINT "mascotas_dueño_id_fkey" FOREIGN KEY ("dueño_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_veterinario_id_fkey" FOREIGN KEY ("veterinario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacunas" ADD CONSTRAINT "vacunas_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacunas" ADD CONSTRAINT "vacunas_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desparasitaciones" ADD CONSTRAINT "desparasitaciones_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratamientos" ADD CONSTRAINT "tratamientos_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consultas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tratamientos" ADD CONSTRAINT "tratamientos_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examenes" ADD CONSTRAINT "examenes_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_peso" ADD CONSTRAINT "registros_peso_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_alimentacion" ADD CONSTRAINT "registros_alimentacion_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_clinica_id_fkey" FOREIGN KEY ("clinica_id") REFERENCES "clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_accesos" ADD CONSTRAINT "bitacora_accesos_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_accesos" ADD CONSTRAINT "bitacora_accesos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios" ADD CONSTRAINT "recordatorios_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalias" ADD CONSTRAINT "anomalias_mascota_id_fkey" FOREIGN KEY ("mascota_id") REFERENCES "mascotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
