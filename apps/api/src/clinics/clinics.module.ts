import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { ClinicsController } from './clinics.controller.js';
import { ClinicsService } from './clinics.service.js';
import { LinkCodesService } from './link-codes.service.js';
import { SignupLinksService } from './signup-links.service.js';
import { TeamService } from './team.service.js';

@Module({
  imports: [MailModule],
  controllers: [ClinicsController],
  providers: [
    ClinicsService,
    LinkCodesService,
    TeamService,
    SignupLinksService,
  ],
  exports: [ClinicsService, LinkCodesService, TeamService, SignupLinksService],
})
export class ClinicsModule {}
