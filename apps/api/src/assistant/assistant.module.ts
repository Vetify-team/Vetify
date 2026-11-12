import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { PetsModule } from '../pets/pets.module.js';
import { RecordsModule } from '../records/records.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { LlmClient, OpenAiCompatibleLlmClient } from './llm.client.js';

@Module({
  imports: [PermissionsModule, PetsModule, RecordsModule, BillingModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    { provide: LlmClient, useClass: OpenAiCompatibleLlmClient },
  ],
})
export class AssistantModule {}
