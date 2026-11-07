import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { PetsController } from './pets.controller.js';
import { PetsService } from './pets.service.js';

@Module({
  imports: [PermissionsModule],
  controllers: [PetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}
