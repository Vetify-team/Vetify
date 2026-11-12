import { CardController, CardService } from './card.js';
import { NotificationsController } from '../notifications/notifications.controller.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module.js';
import { MailModule } from '../mail/mail.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { PetsModule } from '../pets/pets.module.js';
import { AlertsController } from './alerts.controller.js';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';
import { VaccinationStatusService } from './vaccination-status.service.js';

@Module({
  imports: [FilesModule, MailModule, PermissionsModule, PetsModule],
  controllers: [
    RecordsController,
    AlertsController,
    CardController,
    NotificationsController,
  ],
  providers: [
    RecordsService,
    VaccinationStatusService,
    CardService,
    NotificationsService,
  ],
  // The assistant reads the record through these, as the caller.
  exports: [RecordsService, VaccinationStatusService],
})
export class RecordsModule {}
