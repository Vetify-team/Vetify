import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExpedienteService } from './expediente.service.js';

@ApiTags('expediente')
@Controller('expediente')
export class ExpedienteController {
  constructor(private readonly expedienteService: ExpedienteService) {}
}
