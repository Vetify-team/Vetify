import { Module } from '@nestjs/common';
import { IaService } from './ia.service.js';
import { IaController } from './ia.controller.js';

@Module({
  controllers: [IaController],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}
