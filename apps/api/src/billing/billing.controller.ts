import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  billingStatusSchema,
  checkoutSchema,
  confirmPaymentSchema,
  paymentSchema,
  type Checkout,
  type ConfirmPayment,
  type TokenPayload,
} from '@vetify/types';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ZodBody, ZodResponse } from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { BillingService } from './billing.service.js';

/** Each checkout calls Tilopay; a few per minute is plenty for a person. */
const CHECKOUT_LIMIT = { general: { ttl: 60_000, limit: 10 } };

@ApiTags('billing')
@ApiBearerAuth()
@Roles('owner', 'clinic')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Current plan and recent payments' })
  @ZodResponse('BillingStatus', billingStatusSchema)
  status(@CurrentUser() user: TokenPayload) {
    return this.billing.status(user);
  }

  @Post('checkout')
  @Throttle(CHECKOUT_LIMIT)
  @ApiOperation({
    summary: 'Start paying a plan: returns the Tilopay payment form URL',
  })
  @ZodBody('Checkout', checkoutSchema)
  @ZodResponse(
    'CheckoutStarted',
    z.object({ url: z.string().url(), orderNumber: z.string() }),
    { status: 201 },
  )
  checkout(
    @CurrentUser() user: TokenPayload,
    @Req() req: Request,
    @Body(new ZodValidationPipe(checkoutSchema)) body: Checkout,
  ) {
    return this.billing.checkout(user, body.plan, req.header('origin'));
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle(CHECKOUT_LIMIT)
  @ApiOperation({
    summary: 'Confirm a payment with Tilopay and activate its plan',
  })
  @ZodBody('ConfirmPayment', confirmPaymentSchema)
  @ZodResponse('Payment', paymentSchema)
  confirm(
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(confirmPaymentSchema)) body: ConfirmPayment,
  ) {
    return this.billing.confirm(user, body.orderNumber);
  }
}
