import { Injectable } from '@nestjs/common';
import type {
  ActualizarMascota,
  CrearMascota,
  Mascota,
  TokenPayload,
} from '@vetify/types';
import {
  aFechaHora,
  aFechaOpcional,
  desdeFecha,
  desdeFechaOpcional,
} from '../common/mapeo.js';
import type { Mascota as MascotaDb } from '../generated/prisma/client.js';
import { PermisosService } from '../permisos/permisos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const aMascota = (mascota: MascotaDb): Mascota => ({
  id: mascota.id,
  duenoId: mascota.duenoId,
  nombre: mascota.nombre,
  especie: mascota.especie,
  raza: mascota.raza,
  sexo: mascota.sexo,
  fechaNacimiento: aFechaOpcional(mascota.fechaNacimiento),
  esterilizado: mascota.esterilizado,
  microchip: mascota.microchip,
  fotoUrl: mascota.fotoUrl,
  creadoEn: aFechaHora(mascota.creadoEn),
});

/** Datos básicos de la mascota. Lo crea y edita solo su dueño. */
@Injectable()
export class MascotasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permisos: PermisosService,
  ) {}

  /**
   * El dueño ve sus mascotas; la clínica, sus pacientes: las mascotas con un
   * permiso activo de alcance completo para alguna clínica donde trabaja.
   */
  async listar(usuario: TokenPayload): Promise<Mascota[]> {
    const mascotas = await this.prisma.mascota.findMany({
      where: this.permisos.mascotasVisibles(usuario),
      orderBy: { nombre: 'asc' },
    });
    return mascotas.map(aMascota);
  }

  async crear(usuario: TokenPayload, datos: CrearMascota): Promise<Mascota> {
    const mascota = await this.prisma.mascota.create({
      data: {
        duenoId: usuario.sub,
        nombre: datos.nombre,
        especie: datos.especie,
        raza: datos.raza ?? null,
        sexo: datos.sexo ?? null,
        fechaNacimiento: datos.fechaNacimiento
          ? desdeFecha(datos.fechaNacimiento)
          : null,
        esterilizado: datos.esterilizado,
        microchip: datos.microchip ?? null,
        fotoUrl: datos.fotoUrl ?? null,
      },
    });
    return aMascota(mascota);
  }

  async obtener(usuario: TokenPayload, mascotaId: string): Promise<Mascota> {
    const { mascota } = await this.permisos.autorizar(
      usuario,
      mascotaId,
      'leer',
    );
    return aMascota(mascota);
  }

  async actualizar(
    usuario: TokenPayload,
    mascotaId: string,
    datos: ActualizarMascota,
  ): Promise<Mascota> {
    await this.permisos.autorizar(usuario, mascotaId, 'administrar');
    const { fechaNacimiento, ...resto } = datos;
    const mascota = await this.prisma.mascota.update({
      where: { id: mascotaId },
      data: { ...resto, fechaNacimiento: desdeFechaOpcional(fechaNacimiento) },
    });
    return aMascota(mascota);
  }
}
