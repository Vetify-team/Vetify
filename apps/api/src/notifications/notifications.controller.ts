import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { TokenPayload } from '@vetify/types';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ZodBody, ZodResponse } from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  NotificationsService,
  isDevPushTestEnabled,
  subscriptionSchema,
  type SubscriptionInput,
} from './notifications.service.js';
const notificationSchema = z.object({
  id: z.string().uuid(),
  petId: z.string().uuid(),
  petName: z.string(),
  kind: z.string(),
  subject: z.string(),
  dueOn: z.string(),
  offsetDays: z.number(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
const okSchema = z.object({ ok: z.boolean() });
const endpointSchema = z.object({ endpoint: z.string().url().max(2048) });
@ApiTags('notifications')
@ApiBearerAuth()
@Roles('owner')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get('push-config')
  @ZodResponse(
    'PushConfig',
    z.object({ publicKey: z.string().nullable(), testEnabled: z.boolean() }),
  )
  config() {
    return {
      testEnabled: isDevPushTestEnabled(),
      publicKey:
        process.env.VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT
          ? process.env.VAPID_PUBLIC_KEY
          : null,
    };
  }
  @Get()
  @ApiOperation({ summary: 'List the owner inbox' })
  @ZodResponse('Notification', notificationSchema, { list: true })
  list(@CurrentUser() user: TokenPayload) {
    return this.notifications.list(user);
  }
  @Post(':id/read')
  @ApiOperation({ summary: 'Mark an inbox entry read' })
  @ZodResponse('NotificationUpdated', okSchema, { status: 201 })
  read(
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user, id);
  }
  @Post('subscriptions')
  @ApiOperation({ summary: 'Subscribe this device to push' })
  @ZodBody('PushSubscription', subscriptionSchema)
  @ZodResponse('PushSubscribed', okSchema, { status: 201 })
  subscribe(
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(subscriptionSchema)) body: SubscriptionInput,
  ) {
    return this.notifications.subscribe(user, body);
  }
  @Post('subscriptions/status')
  @ZodBody('PushEndpoint', endpointSchema)
  @ZodResponse('PushStatus', z.object({ active: z.boolean() }), { status: 201 })
  status(
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(endpointSchema))
    body: z.infer<typeof endpointSchema>,
  ) {
    return this.notifications.subscriptionStatus(user, body.endpoint);
  }
  @Post('test-push')
  @Throttle({ general: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a development-only test push to this owned subscription',
  })
  @ZodBody('PushEndpoint', endpointSchema)
  @ZodResponse('TestPushAccepted', z.object({ accepted: z.boolean() }), {
    status: 201,
  })
  testPush(
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(endpointSchema))
    body: z.infer<typeof endpointSchema>,
  ) {
    return this.notifications.sendTest(user, body.endpoint);
  }
  @Post('subscriptions/remove')
  @ApiOperation({ summary: 'Remove this device push subscription' })
  @ZodBody('PushEndpoint', endpointSchema)
  @ZodResponse('PushUnsubscribed', okSchema, { status: 201 })
  remove(
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(endpointSchema))
    body: z.infer<typeof endpointSchema>,
  ) {
    return this.notifications.unsubscribe(user, body.endpoint);
  }
}
