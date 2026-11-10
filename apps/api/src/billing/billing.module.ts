import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { OnvoClient } from './onvo.client.js';
import { OnvoWebhookController } from './onvo-webhook.controller.js';

@Module({
  controllers: [BillingController, OnvoWebhookController],
  providers: [BillingService, OnvoClient],
  exports: [BillingService],
})
export class BillingModule {}
