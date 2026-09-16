import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClinicasService } from './clinicas.service.js';

@ApiTags('clinicas')
@Controller('clinicas')
export class ClinicasController {
  constructor(private readonly clinicasService: ClinicasService) {}
}
