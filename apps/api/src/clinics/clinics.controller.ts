import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  clinicSchema,
  linkCodeInputSchema,
  linkCodePreviewSchema,
  linkCodeSchema,
  type Clinic,
  type LinkCode,
  type LinkCodeInput,
  type LinkCodePreview,
  type TokenPayload,
} from '@vetify/types';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ClinicsService } from './clinics.service.js';
import { LinkCodesService } from './link-codes.service.js';

@ApiTags('clinics')
@ApiBearerAuth()
@Controller({ version: '1' })
export class ClinicsController {
  constructor(
    private readonly clinics: ClinicsService,
    private readonly linkCodes: LinkCodesService,
  ) {}

  @Roles('clinic')
  @Get('clinics/mine')
  @ApiOperation({
    summary:
      "The authenticated user's clinic, including whether it is verified",
  })
  @ZodResponse('Clinic', clinicSchema)
  @ErrorResponses(401, 403, 404)
  mine(@CurrentUser() user: TokenPayload): Promise<Clinic> {
    return this.clinics.mine(user.sub);
  }

  @Roles('clinic')
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('clinics/mine/link-codes')
  @ApiOperation({
    summary: 'Issue a link code to show the owner in person',
    description:
      'Single use, valid for 10 minutes. Only verified clinics can issue codes.',
  })
  @ZodResponse('LinkCode', linkCodeSchema, { status: 201 })
  @ErrorResponses(401, 403, 404, 429)
  issueLinkCode(@CurrentUser() user: TokenPayload): Promise<LinkCode> {
    return this.linkCodes.issue(user.sub);
  }

  @Roles('owner')
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('link-codes/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'See which clinic a link code belongs to, before granting access',
  })
  @ZodBody('LinkCodeInput', linkCodeInputSchema)
  @ZodResponse('LinkCodePreview', linkCodePreviewSchema)
  @ErrorResponses(400, 401, 403, 429)
  preview(
    @Body(new ZodValidationPipe(linkCodeInputSchema)) data: LinkCodeInput,
  ): Promise<LinkCodePreview> {
    return this.linkCodes.preview(data.code);
  }
}
