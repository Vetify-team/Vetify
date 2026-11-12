import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  apiErrorSchema,
  assistantReplySchema,
  assistantRequestSchema,
  assistantUsageSchema,
  type AssistantReply,
  type AssistantRequest,
  type AssistantUsage,
  type TokenPayload,
} from '@vetify/types';
import { LogAccess } from '../access-log/access-log.interceptor.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AssistantService } from './assistant.service.js';

/**
 * Each question can cost several model calls: 10 per minute per account
 * (the `account` limiter keys on the token's user), well under the general
 * limit.
 */
const ASSISTANT_LIMIT = { account: { ttl: 60_000, limit: 10 } };

@ApiTags('assistant')
@ApiBearerAuth()
@ApiParam({ name: 'petId', description: 'Pet id (UUID)' })
@Roles('owner', 'clinic')
@Controller({ path: 'pets/:petId/assistant', version: '1' })
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @Throttle(ASSISTANT_LIMIT)
  @LogAccess('use_assistant', { dedupe: true })
  @ApiOperation({
    summary:
      'Ask the pet assistant; send the whole conversation, the question last',
    description:
      'Owners get plain language, clinics technical answers (from the role). ' +
      'The record is read with the caller’s own permissions; nothing of the ' +
      'conversation is stored.',
  })
  @ZodBody('AssistantRequest', assistantRequestSchema)
  @ZodResponse('AssistantReply', assistantReplySchema)
  @ErrorResponses(400, 401, 403, 404)
  @ZodResponse('ApiError', apiErrorSchema, {
    status: 429,
    description:
      '`RATE_LIMITED`: more than 10 questions in a minute, or, with reason ' +
      '`ASSISTANT_LIMIT`, the free plan used up its monthly messages.',
  })
  @ZodResponse('ApiError', apiErrorSchema, {
    status: 503,
    description:
      '`ASSISTANT_UNAVAILABLE`: reason `ASSISTANT_DISABLED` (no provider ' +
      'configured) or `ASSISTANT_UNAVAILABLE` (the provider failed or timed out).',
  })
  messages(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(assistantRequestSchema)) body: AssistantRequest,
  ): Promise<AssistantReply> {
    return this.assistant.reply(user, petId, body);
  }

  @Get('usage')
  @ApiOperation({
    summary: "This month's assistant messages and the allowance",
    description:
      'The same access checks as a question. `limit` is null when unlimited ' +
      '(Premium, clinics, or payments off). Reads no record data.',
  })
  @ZodResponse('AssistantUsage', assistantUsageSchema)
  @ErrorResponses(401, 403, 404)
  usage(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<AssistantUsage> {
    return this.assistant.usageFor(user, petId);
  }
}
