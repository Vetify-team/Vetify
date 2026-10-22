import { Module } from '@nestjs/common';
import { ClinicsController } from './clinics.controller.js';
import { ClinicsService } from './clinics.service.js';
import { LinkCodesService } from './link-codes.service.js';

@Module({
  controllers: [ClinicsController],
  providers: [ClinicsService, LinkCodesService],
  exports: [ClinicsService, LinkCodesService],
})
export class ClinicsModule {}
