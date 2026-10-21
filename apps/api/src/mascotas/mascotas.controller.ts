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
  mascotaSchema,
  actualizarMascotaSchema,
  crearMascotaSchema,
  type ActualizarMascota,
  type CrearMascota,
  type Mascota,
  type TokenPayload,
} from '@vetify/types';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Cuerpo, Errores, Respuesta } from '../common/openapi/zod-openapi.js';
import { AccionBitacora } from '../common/interceptors/bitacora.interceptor.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { MascotasService } from './mascotas.service.js';

@ApiTags('mascotas')
@ApiBearerAuth()
@Controller('mascotas')
export class MascotasController {
  constructor(private readonly mascotasService: MascotasService) {}

  @Get()
  @ApiOperation({
    summary:
      'Mascotas del dueño, o pacientes con permiso activo si es una clínica',
  })
  @Respuesta('Mascota', mascotaSchema, { lista: true })
  @Errores(401)
  listar(@UsuarioActual() usuario: TokenPayload): Promise<Mascota[]> {
    return this.mascotasService.listar(usuario);
  }

  @Roles('dueño')
  @Post()
  @ApiOperation({ summary: 'Registrar una mascota' })
  @Cuerpo('CrearMascota', crearMascotaSchema)
  @Respuesta('Mascota', mascotaSchema, { estado: 201 })
  @Errores(400, 401, 403)
  crear(
    @UsuarioActual() usuario: TokenPayload,
    @Body(new ZodValidationPipe(crearMascotaSchema)) datos: CrearMascota,
  ): Promise<Mascota> {
    return this.mascotasService.crear(usuario, datos);
  }

  @Get(':mascotaId')
  @AccionBitacora('ver_mascota')
  @ApiOperation({ summary: 'Datos de una mascota' })
  @ApiParam({ name: 'mascotaId', description: 'Id de la mascota (UUID)' })
  @Respuesta('Mascota', mascotaSchema)
  @Errores(401, 403, 404)
  obtener(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
  ): Promise<Mascota> {
    return this.mascotasService.obtener(usuario, mascotaId);
  }

  @Roles('dueño')
  @Patch(':mascotaId')
  @AccionBitacora('editar_mascota')
  @ApiOperation({ summary: 'Editar los datos de una mascota' })
  @ApiParam({ name: 'mascotaId', description: 'Id de la mascota (UUID)' })
  @Cuerpo('ActualizarMascota', actualizarMascotaSchema)
  @Respuesta('Mascota', mascotaSchema)
  @Errores(400, 401, 403, 404)
  actualizar(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(actualizarMascotaSchema))
    datos: ActualizarMascota,
  ): Promise<Mascota> {
    return this.mascotasService.actualizar(usuario, mascotaId, datos);
  }
}
