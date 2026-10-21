import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { avisoSchema, type Aviso, type TokenPayload } from '@vetify/types';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Errores, Respuesta } from '../common/openapi/zod-openapi.js';
import { ExpedienteService } from './expediente.service.js';

@ApiTags('expediente')
@ApiBearerAuth()
@Controller('avisos')
export class AvisosController {
  constructor(private readonly expedienteService: ExpedienteService) {}

  @Get()
  @ApiOperation({
    summary:
      'Dosis atrasadas y próximas de las mascotas del dueño, o de los pacientes de la clínica',
  })
  @Respuesta('Aviso', avisoSchema, { lista: true })
  @Errores(401)
  listar(@UsuarioActual() usuario: TokenPayload): Promise<Aviso[]> {
    return this.expedienteService.avisos(usuario);
  }
}
