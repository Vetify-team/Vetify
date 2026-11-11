import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

@Module({
  imports: [PermissionsModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
