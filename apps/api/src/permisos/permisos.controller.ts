import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  otorgarPermisoSchema,
  type EntradaBitacora,
  type OtorgarPermiso,
  type Permiso,
  type PermisoConClinica,
  type TokenPayload,
} from '@vetify/types';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { AccionBitacora } from '../common/interceptors/bitacora.interceptor.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PermisosService } from './permisos.service.js';

@ApiTags('permisos')
@ApiBearerAuth()
@Roles('dueño')
@Controller('mascotas/:mascotaId')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get('permisos')
  @AccionBitacora('ver_permisos')
  @ApiOperation({
    summary: 'Clínicas con acceso a la mascota (activas y revocadas)',
  })
  listar(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
  ): Promise<PermisoConClinica[]> {
    return this.permisosService.listar(usuario, mascotaId);
  }

  @Post('permisos')
  @AccionBitacora('otorgar_permiso')
  @ApiOperation({
    summary: 'Otorgar a una clínica acceso al expediente o solo al carné',
  })
  otorgar(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(otorgarPermisoSchema)) datos: OtorgarPermiso,
  ): Promise<PermisoConClinica> {
    return this.permisosService.otorgar(usuario, mascotaId, datos);
  }

  @Patch('permisos/:permisoId/revocar')
  @AccionBitacora('revocar_permiso')
  @ApiOperation({
    summary: 'Revocar un permiso; el acceso se corta de inmediato',
  })
  revocar(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Param('permisoId', ParseUUIDPipe) permisoId: string,
  ): Promise<Permiso> {
    return this.permisosService.revocar(usuario, mascotaId, permisoId);
  }

  @Get('bitacora')
  @AccionBitacora('ver_bitacora')
  @ApiOperation({ summary: 'Quién accedió al expediente y cuándo' })
  bitacora(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
  ): Promise<EntradaBitacora[]> {
    return this.permisosService.bitacora(usuario, mascotaId);
  }
}
