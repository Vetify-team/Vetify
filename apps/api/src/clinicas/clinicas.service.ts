import { NotFoundException, Injectable } from '@nestjs/common';
import type { Clinica } from '@vetify/types';
import { aFechaHora } from '../common/mapeo.js';
import type { Clinica as ClinicaDb } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const aClinica = (clinica: ClinicaDb): Clinica => ({
  id: clinica.id,
  nombre: clinica.nombre,
  direccion: clinica.direccion,
  pais: clinica.pais,
  plan: clinica.plan,
  cantidadVeterinarios: clinica.cantidadVeterinarios,
  creadoEn: aFechaHora(clinica.creadoEn),
});

/**
 * Clínicas y su personal. El directorio es público para usuarios autenticados
 * porque el dueño necesita encontrar la clínica a la que va a dar permiso; no
 * expone nada del expediente.
 */
@Injectable()
export class ClinicasService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(busqueda: string): Promise<Clinica[]> {
    const clinicas = await this.prisma.clinica.findMany({
      where: busqueda
        ? { nombre: { contains: busqueda, mode: 'insensitive' } }
        : {},
      orderBy: { nombre: 'asc' },
      take: 20,
    });
    return clinicas.map(aClinica);
  }

  /** Clínica a la que pertenece el usuario de rol `clinica`. */
  async deUsuario(usuarioId: string): Promise<Clinica> {
    const vinculo = await this.prisma.clinicaPersonal.findFirst({
      where: { usuarioId },
      include: { clinica: true },
    });
    if (!vinculo)
      throw new NotFoundException(
        'Tu usuario no está vinculado a ninguna clínica',
      );
    return aClinica(vinculo.clinica);
  }
}
