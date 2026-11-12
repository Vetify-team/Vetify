import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  clinicSignupLinkSchema,
  createClinicSignupLinkSchema,
  issuedClinicSignupLinkSchema,
  type ClinicSignupLink,
  type CreateClinicSignupLink,
  type IssuedClinicSignupLink,
  type TokenPayload,
} from '@vetify/types';
import type { Request } from 'express';
import { SignupLinksService } from '../clinics/signup-links.service.js';
import type { Env } from '../config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { requireAllowedOrigin } from '../common/http/origin.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller({ path: 'admin/clinic-signup-links', version: '1' })
export class SignupLinksController {
  constructor(
    private readonly links: SignupLinksService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Clinic sign-up links not used, revoked or expired',
  })
  @ZodResponse('ClinicSignupLink', clinicSignupLinkSchema, { list: true })
  @ErrorResponses(401, 403)
  pending(): Promise<ClinicSignupLink[]> {
    return this.links.pending();
  }

  @Post()
  @ApiOperation({
    summary: 'Issue a single-use link for a clinic to register',
    description:
      'After the plan is agreed and paid. The link points to the requesting site (its Origin must be allowed), is emailed and returned once, and expires in 7 days.',
  })
  @ZodBody('CreateClinicSignupLink', createClinicSignupLinkSchema)
  @ZodResponse('IssuedClinicSignupLink', issuedClinicSignupLinkSchema, {
    status: 201,
  })
  @ErrorResponses(400, 401, 403, 409)
  issue(
    @Req() req: Request,
    @CurrentUser() admin: TokenPayload,
    @Body(new ZodValidationPipe(createClinicSignupLinkSchema))
    data: CreateClinicSignupLink,
  ): Promise<IssuedClinicSignupLink> {
    const origin = requireAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    return this.links.issue(admin.sub, data, origin);
  }

  @Post(':linkId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw an unused sign-up link' })
  @ApiParam({ name: 'linkId', description: 'Sign-up link id (UUID)' })
  @ApiNoContentResponse({ description: 'Withdrawn' })
  @ErrorResponses(401, 403, 404)
  async revoke(@Param('linkId', ParseUUIDPipe) linkId: string): Promise<void> {
    await this.links.revoke(linkId);
  }
}
