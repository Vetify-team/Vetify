import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { PetsModule } from '../pets/pets.module.js';
import { AlertsController } from './alerts.controller.js';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';
import { VaccinationStatusService } from './vaccination-status.service.js';

@Module({
  imports: [PermissionsModule, PetsModule],
  controllers: [RecordsController, AlertsController],
  providers: [RecordsService, VaccinationStatusService],
})
export class RecordsModule {}
