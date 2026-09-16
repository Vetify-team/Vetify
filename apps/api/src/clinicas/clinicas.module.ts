import { Module } from '@nestjs/common';
import { ClinicasService } from './clinicas.service.js';
import { ClinicasController } from './clinicas.controller.js';

@Module({
  controllers: [ClinicasController],
  providers: [ClinicasService],
  exports: [ClinicasService],
})
export class ClinicasModule {}
