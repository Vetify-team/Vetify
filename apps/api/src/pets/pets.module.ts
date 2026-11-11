import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { FilesModule } from '../files/files.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { PetsController } from './pets.controller.js';
import { PetsService } from './pets.service.js';

@Module({
  imports: [PermissionsModule, BillingModule, FilesModule],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}
