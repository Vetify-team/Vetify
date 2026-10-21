import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { AlertsController } from './alerts.controller.js';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';

@Module({
  imports: [PermissionsModule],
  controllers: [RecordsController, AlertsController],
  providers: [RecordsService],
})
export class RecordsModule {}
