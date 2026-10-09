import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EntradaBitacora,
  OtorgarPermiso,
  Permiso,
  PermisoConClinica,
  TokenPayload,
} from '@vetify/types';
import { aFechaHora, aRol } from '../common/mapeo.js';
import type {
  Prisma,
  Clinica as ClinicaDb,
  Mascota as MascotaDb,
  Permiso as PermisoDb,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { aClinica } from '../clinicas/clinicas.service.js';

/**
 * Qué se quiere hacer con el expediente:
 * - `leer`: ver datos y expediente (dueño o clínica con permiso completo).
 * - `acto_medico`: consultas, vacunas, exámenes… (solo clínica con permiso).
 * - `dia_a_dia`: peso y alimentación (solo el dueño).
 * - `administrar`: editar la mascota y gestionar permisos (solo el dueño).
 */
export type Operacion = 'leer' | 'acto_medico' | 'dia_a_dia' | 'administrar';

export interface Acceso {
  mascota: MascotaDb;
  /** Clínica en nombre de la cual actúa el usuario; null si es el dueño. */
  clinicaId: string | null;
}

const SIN_PERMISO = 'Tu clínica no tiene un permiso activo sobre esta mascota';

export const aPermiso = (permiso: PermisoDb): Permiso => ({
  id: permiso.id,
  mascotaId: permiso.mascotaId,
  clinicaId: permiso.clinicaId,
  alcance: permiso.alcance,
  estado: permiso.estado,
  creadoEn: aFechaHora(permiso.creadoEn),
});

/**
 * Consentimiento dueño → clínica y la autorización que se deriva de él.
 * `autorizar` es la única puerta al expediente: todo servicio que toque datos
 * de una mascota pasa por acá antes de leer o escribir.
 */
@Injectable()
export class PermisosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mascotas que el usuario puede ver en un listado: las propias si es dueño;
   * si es clínica, sus pacientes con permiso activo de alcance completo.
   * Es el mismo criterio de `autorizar`, expresado como filtro de Prisma.
   */
  mascotasVisibles(usuario: TokenPayload): Prisma.MascotaWhereInput {
    return usuario.rol === 'dueño'
      ? { duenoId: usuario.sub }
      : {
          permisos: {
            some: {
              estado: 'activo',
              alcance: 'completo',
              clinica: { personal: { some: { usuarioId: usuario.sub } } },
            },
          },
        };
  }

  async autorizar(
    usuario: TokenPayload,
    mascotaId: string,
    operacion: Operacion,
  ): Promise<Acceso> {
    if (usuario.rol === 'dueño') {
      const mascota = await this.prisma.mascota.findUnique({
        where: { id: mascotaId },
      });
      // A quien no es dueño se le responde 404 para no revelar que la mascota existe.
      if (!mascota || mascota.duenoId !== usuario.sub) {
        throw new NotFoundException('Mascota no encontrada');
      }
      if (operacion === 'acto_medico') {
        throw new ForbiddenException(
          'El acto médico lo registra la clínica veterinaria',
        );
      }
      return { mascota, clinicaId: null };
    }

    if (operacion === 'dia_a_dia' || operacion === 'administrar') {
      throw new ForbiddenException(
        'Esta acción le corresponde al dueño de la mascota',
      );
    }

    const permiso = await this.prisma.permiso.findFirst({
      where: {
        mascotaId,
        estado: 'activo',
        alcance: 'completo',
        clinica: { personal: { some: { usuarioId: usuario.sub } } },
      },
      include: { mascota: true },
    });
    if (!permiso) throw new ForbiddenException(SIN_PERMISO);

    return { mascota: permiso.mascota, clinicaId: permiso.clinicaId };
  }

  async listar(
    usuario: TokenPayload,
    mascotaId: string,
  ): Promise<PermisoConClinica[]> {
    await this.autorizar(usuario, mascotaId, 'administrar');
    const permisos = await this.prisma.permiso.findMany({
      where: { mascotaId },
      include: { clinica: true },
      orderBy: { creadoEn: 'desc' },
    });
    return permisos.map((permiso) => ({
      ...aPermiso(permiso),
      clinica: aClinica(permiso.clinica),
    }));
  }

  /** Otorgar de nuevo a una clínica revocada reactiva el mismo registro. */
  async otorgar(
    usuario: TokenPayload,
    mascotaId: string,
    datos: OtorgarPermiso,
  ): Promise<PermisoConClinica> {
    await this.autorizar(usuario, mascotaId, 'administrar');

    const clinica: ClinicaDb | null = await this.prisma.clinica.findUnique({
      where: { id: datos.clinicaId },
    });
    if (!clinica) throw new NotFoundException('Clínica no encontrada');

    const permiso = await this.prisma.permiso.upsert({
      where: { mascotaId_clinicaId: { mascotaId, clinicaId: datos.clinicaId } },
      create: { mascotaId, clinicaId: datos.clinicaId, alcance: datos.alcance },
      update: { alcance: datos.alcance, estado: 'activo' },
    });
    return { ...aPermiso(permiso), clinica: aClinica(clinica) };
  }

  /** Revocar corta el acceso en la siguiente petición: no hay caché de permisos. */
  async revocar(
    usuario: TokenPayload,
    mascotaId: string,
    permisoId: string,
  ): Promise<Permiso> {
    await this.autorizar(usuario, mascotaId, 'administrar');

    const { count } = await this.prisma.permiso.updateMany({
      where: { id: permisoId, mascotaId },
      data: { estado: 'revocado' },
    });
    if (count === 0) throw new NotFoundException('Permiso no encontrado');

    return aPermiso(
      await this.prisma.permiso.findUniqueOrThrow({ where: { id: permisoId } }),
    );
  }

  async bitacora(
    usuario: TokenPayload,
    mascotaId: string,
  ): Promise<EntradaBitacora[]> {
    await this.autorizar(usuario, mascotaId, 'administrar');
    const entradas = await this.prisma.bitacoraAcceso.findMany({
      where: { mascotaId },
      orderBy: { fecha: 'desc' },
      take: 200,
      include: { usuario: { select: { nombre: true, rol: true } } },
    });
    return entradas.map((entrada) => ({
      id: entrada.id,
      mascotaId: entrada.mascotaId,
      usuarioId: entrada.usuarioId,
      accion: entrada.accion,
      fecha: aFechaHora(entrada.fecha),
      actor: entrada.usuario
        ? { nombre: entrada.usuario.nombre, rol: aRol(entrada.usuario.rol) }
        : null,
    }));
  }
}
