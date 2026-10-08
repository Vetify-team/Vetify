import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TokenPayload } from '@vetify/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PermisosService } from './permisos.service.js';

const MASCOTA_ID = '11111111-1111-4111-8111-111111111111';
const DUENO: TokenPayload = {
  sub: '22222222-2222-4222-8222-222222222222',
  correo: 'ana@correo.cr',
  rol: 'dueño',
};
const OTRO_DUENO: TokenPayload = {
  ...DUENO,
  sub: '33333333-3333-4333-8333-333333333333',
};
const CLINICA: TokenPayload = {
  sub: '44444444-4444-4444-8444-444444444444',
  correo: 'vet@clinica.cr',
  rol: 'clinica',
};

const mascota = { id: MASCOTA_ID, duenoId: DUENO.sub, especie: 'perro' };

describe('PermisosService.autorizar', () => {
  let prisma: {
    mascota: { findUnique: ReturnType<typeof vi.fn> };
    permiso: { findFirst: ReturnType<typeof vi.fn> };
  };
  let servicio: PermisosService;

  beforeEach(() => {
    prisma = {
      mascota: { findUnique: vi.fn().mockResolvedValue(mascota) },
      permiso: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    servicio = new PermisosService(prisma as unknown as PrismaService);
  });

  it('deja al dueño leer y registrar el día a día de su mascota', async () => {
    await expect(
      servicio.autorizar(DUENO, MASCOTA_ID, 'leer'),
    ).resolves.toMatchObject({ clinicaId: null });
    await expect(
      servicio.autorizar(DUENO, MASCOTA_ID, 'dia_a_dia'),
    ).resolves.toBeDefined();
  });

  it('responde 404 a un dueño que no es el de la mascota, sin revelar que existe', async () => {
    await expect(
      servicio.autorizar(OTRO_DUENO, MASCOTA_ID, 'leer'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no deja al dueño registrar un acto médico', async () => {
    await expect(
      servicio.autorizar(DUENO, MASCOTA_ID, 'acto_medico'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('niega con 403 a una clínica sin permiso activo', async () => {
    await expect(
      servicio.autorizar(CLINICA, MASCOTA_ID, 'leer'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      servicio.autorizar(CLINICA, MASCOTA_ID, 'acto_medico'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('solo busca permisos activos, de alcance completo y de una clínica del usuario', async () => {
    await servicio
      .autorizar(CLINICA, MASCOTA_ID, 'leer')
      .catch(() => undefined);

    expect(prisma.permiso.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          mascotaId: MASCOTA_ID,
          estado: 'activo',
          alcance: 'completo',
          clinica: { personal: { some: { usuarioId: CLINICA.sub } } },
        },
      }),
    );
  });

  it('autoriza a la clínica con permiso activo y devuelve en nombre de qué clínica actúa', async () => {
    prisma.permiso.findFirst.mockResolvedValue({
      clinicaId: 'clinica-1',
      mascota,
    });

    await expect(
      servicio.autorizar(CLINICA, MASCOTA_ID, 'acto_medico'),
    ).resolves.toEqual({
      mascota,
      clinicaId: 'clinica-1',
    });
  });

  it('no deja a una clínica tocar el día a día ni administrar, aunque tenga permiso', async () => {
    prisma.permiso.findFirst.mockResolvedValue({
      clinicaId: 'clinica-1',
      mascota,
    });

    await expect(
      servicio.autorizar(CLINICA, MASCOTA_ID, 'dia_a_dia'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      servicio.autorizar(CLINICA, MASCOTA_ID, 'administrar'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
