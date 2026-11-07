import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { TilopayClient } from './tilopay.client.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, TilopayClient],
  exports: [BillingService],
})
export class BillingModule {}
