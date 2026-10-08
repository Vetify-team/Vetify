import { Module } from '@nestjs/common';
import { PermisosModule } from '../permisos/permisos.module.js';
import { ExpedienteService } from './expediente.service.js';
import { ExpedienteController } from './expediente.controller.js';
import { AvisosController } from './avisos.controller.js';

@Module({
  imports: [PermisosModule],
  controllers: [ExpedienteController, AvisosController],
  providers: [ExpedienteService],
  exports: [ExpedienteService],
})
export class ExpedienteModule {}
