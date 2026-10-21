import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import {
  entradaBitacoraSchema,
  permisoConClinicaSchema,
  permisoSchema,
  otorgarPermisoSchema,
  type EntradaBitacora,
  type OtorgarPermiso,
  type Permiso,
  type PermisoConClinica,
  type TokenPayload,
} from '@vetify/types';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Cuerpo, Errores, Respuesta } from '../common/openapi/zod-openapi.js';
import { AccionBitacora } from '../common/interceptors/bitacora.interceptor.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PermisosService } from './permisos.service.js';

@ApiTags('permisos')
@ApiBearerAuth()
@ApiParam({ name: 'mascotaId', description: 'Id de la mascota (UUID)' })
@Roles('dueño')
@Controller('mascotas/:mascotaId')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Get('permisos')
  @AccionBitacora('ver_permisos')
  @ApiOperation({
    summary: 'Clínicas con acceso a la mascota (activas y revocadas)',
  })
  @Respuesta('PermisoConClinica', permisoConClinicaSchema, { lista: true })
  @Errores(401, 403, 404)
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
  @Cuerpo('OtorgarPermiso', otorgarPermisoSchema)
  @Respuesta('PermisoConClinica', permisoConClinicaSchema, { estado: 201 })
  @Errores(400, 401, 403, 404)
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
  @ApiParam({ name: 'permisoId', description: 'Id del permiso a revocar' })
  @Respuesta('Permiso', permisoSchema)
  @Errores(401, 403, 404)
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
  @Respuesta('EntradaBitacora', entradaBitacoraSchema, { lista: true })
  @Errores(401, 403, 404)
  bitacora(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
  ): Promise<EntradaBitacora[]> {
    return this.permisosService.bitacora(usuario, mascotaId);
  }
}
