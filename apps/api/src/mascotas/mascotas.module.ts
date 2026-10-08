import { Module } from '@nestjs/common';
import { PermisosModule } from '../permisos/permisos.module.js';
import { MascotasService } from './mascotas.service.js';
import { MascotasController } from './mascotas.controller.js';

@Module({
  imports: [PermisosModule],
  controllers: [MascotasController],
  providers: [MascotasService],
  exports: [MascotasService],
})
export class MascotasModule {}
