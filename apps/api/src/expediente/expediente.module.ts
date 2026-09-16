import { Module } from '@nestjs/common';
import { ExpedienteService } from './expediente.service.js';
import { ExpedienteController } from './expediente.controller.js';

@Module({
  controllers: [ExpedienteController],
  providers: [ExpedienteService],
  exports: [ExpedienteService],
})
export class ExpedienteModule {}
