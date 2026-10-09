import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  buscarClinicasSchema,
  type BuscarClinicas,
  type Clinica,
  type TokenPayload,
} from '@vetify/types';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
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
  buscar(
    @Query(new ZodValidationPipe(buscarClinicasSchema)) filtro: BuscarClinicas,
  ): Promise<Clinica[]> {
    return this.clinicasService.buscar(filtro.busqueda);
  }

  @Roles('clinica')
  @Get('mia')
  @ApiOperation({ summary: 'Clínica del usuario autenticado' })
  mia(@UsuarioActual() usuario: TokenPayload): Promise<Clinica> {
    return this.clinicasService.deUsuario(usuario.sub);
  }
}
