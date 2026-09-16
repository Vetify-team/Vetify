import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MascotasService } from './mascotas.service.js';

@ApiTags('mascotas')
@Controller('mascotas')
export class MascotasController {
  constructor(private readonly mascotasService: MascotasService) {}
}
