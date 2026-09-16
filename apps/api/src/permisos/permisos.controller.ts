import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermisosService } from './permisos.service.js';

@ApiTags('permisos')
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}
}
