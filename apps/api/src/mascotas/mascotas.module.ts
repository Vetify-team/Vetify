import { Module } from '@nestjs/common';
import { MascotasService } from './mascotas.service.js';
import { MascotasController } from './mascotas.controller.js';

@Module({
  controllers: [MascotasController],
  providers: [MascotasService],
  exports: [MascotasService],
})
export class MascotasModule {}
