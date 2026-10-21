import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import {
  clinicaSchema,
  buscarClinicasSchema,
  type BuscarClinicas,
  type Clinica,
  type TokenPayload,
} from '@vetify/types';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Errores, Respuesta } from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ClinicasService } from './clinicas.service.js';

@ApiTags('clinicas')
@ApiBearerAuth()
@Controller('clinicas')
export class ClinicasController {
  constructor(private readonly clinicasService: ClinicasService) {}

  @Get()
  @ApiOperation({
    summary: 'Buscar clínicas por nombre para otorgarles permiso',
  })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    description: 'Parte del nombre. Vacío lista las primeras 20.',
  })
  @Respuesta('Clinica', clinicaSchema, { lista: true })
  @Errores(401)
  buscar(
    @Query(new ZodValidationPipe(buscarClinicasSchema)) filtro: BuscarClinicas,
  ): Promise<Clinica[]> {
    return this.clinicasService.buscar(filtro.busqueda);
  }

  @Roles('clinica')
  @Get('mia')
  @ApiOperation({ summary: 'Clínica del usuario autenticado' })
  @Respuesta('Clinica', clinicaSchema)
  @Errores(401, 403, 404)
  mia(@UsuarioActual() usuario: TokenPayload): Promise<Clinica> {
    return this.clinicasService.deUsuario(usuario.sub);
  }
}
