import { Module } from '@nestjs/common';
import { ClinicsModule } from '../clinics/clinics.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SignupLinksController } from './signup-links.controller.js';

@Module({
  imports: [ClinicsModule],
  controllers: [AdminController, SignupLinksController],
  providers: [AdminService],
})
export class AdminModule {}
