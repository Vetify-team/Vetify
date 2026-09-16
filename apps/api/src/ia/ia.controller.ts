import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IaService } from './ia.service.js';

@ApiTags('ia')
@Controller('ia')
export class IaController {
  constructor(private readonly iaService: IaService) {}
}
