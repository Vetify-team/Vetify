import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppException, badRequest } from '../common/errors.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { Env } from '../config.js';
import { verifyWebhookSignature } from './billing.logic.js';
import { BillingService, type OnvoEvent } from './billing.service.js';

/**
 * ONVO's webhook (registered in the ONVO Dashboard). No session: the
 * signature over the raw body is the authentication. A 2xx tells ONVO to stop
 * retrying, so errors reading ONVO back answer 503 and it tries again.
 */
@ApiExcludeController()
@Public()
@Controller({ path: 'billing/webhooks', version: '1' })
export class OnvoWebhookController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('onvo')
  @HttpCode(HttpStatus.OK)
  async onvo(@Req() req: RawBodyRequest<Request>) {
    const secret = this.config.get('ONVO_WEBHOOK_SECRET', { infer: true });
    if (!secret) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'BILLING_UNAVAILABLE',
        'Webhooks are not configured',
      );
    }
    if (
      !req.rawBody ||
      !verifyWebhookSignature(
        req.header('x-onvo-signature'),
        req.rawBody,
        secret,
      )
    ) {
      throw badRequest('Invalid signature');
    }
    await this.billing.handleEvent(req.body as OnvoEvent);
    return { received: true };
  }
}
