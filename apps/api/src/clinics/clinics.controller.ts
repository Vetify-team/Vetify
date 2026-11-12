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
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ipThrottle } from '../common/http/rate-limits.js';
import {
  clinicInvitationPreviewSchema,
  clinicSignupPreviewSchema,
  clinicInvitationSchema,
  clinicMemberSchema,
  createClinicInvitationSchema,
  invitationTokenSchema,
  myClinicSchema,
  linkCodeInputSchema,
  linkCodePreviewSchema,
  linkCodeSchema,
  type ClinicInvitation,
  type ClinicInvitationPreview,
  type ClinicSignupPreview,
  type ClinicMember,
  type CreateClinicInvitation,
  type InvitationToken,
  type MyClinic,
  type LinkCode,
  type LinkCodeInput,
  type LinkCodePreview,
  type TokenPayload,
} from '@vetify/types';
import type { Env } from '../config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { requireAllowedOrigin } from '../common/http/origin.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ClinicsService } from './clinics.service.js';
import { LinkCodesService } from './link-codes.service.js';
import { SignupLinksService } from './signup-links.service.js';
import { TeamService } from './team.service.js';

@ApiTags('clinics')
@ApiBearerAuth()
@Controller({ version: '1' })
export class ClinicsController {
  constructor(
    private readonly clinics: ClinicsService,
    private readonly linkCodes: LinkCodesService,
    private readonly team: TeamService,
    private readonly signupLinks: SignupLinksService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Roles('clinic')
  @Get('clinics/mine')
  @ApiOperation({
    summary:
      "The authenticated user's clinic, whether it is verified, and their role in it",
  })
  @ZodResponse('MyClinic', myClinicSchema)
  @ErrorResponses(401, 403)
  mine(@CurrentUser() user: TokenPayload): Promise<MyClinic> {
    return this.clinics.mine(user.sub);
  }

  @Roles('clinic')
  @Throttle({ general: ipThrottle('linkCodeCreate') })
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
  @Throttle({ general: ipThrottle('linkCodePreview') })
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

  // ---------- Team (clinic administrators) ----------

  @Roles('clinic')
  @Get('clinics/mine/staff')
  @ApiOperation({ summary: "The clinic's team (administrators only)" })
  @ZodResponse('ClinicMember', clinicMemberSchema, { list: true })
  @ErrorResponses(401, 403)
  members(@CurrentUser() user: TokenPayload): Promise<ClinicMember[]> {
    return this.team.members(user.sub);
  }

  @Roles('clinic')
  @Post('clinics/mine/staff/:userId/remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove someone from the team',
    description:
      'They lose access to the clinic at once and their sessions are revoked. The last administrator cannot be removed.',
  })
  @ApiParam({ name: 'userId', description: 'Member user id (UUID)' })
  @ApiNoContentResponse({ description: 'Removed' })
  @ErrorResponses(400, 401, 403, 404)
  async removeMember(
    @CurrentUser() user: TokenPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.team.remove(user.sub, userId);
  }

  @Roles('clinic')
  @Get('clinics/mine/invitations')
  @ApiOperation({ summary: 'Pending team invitations (administrators only)' })
  @ZodResponse('ClinicInvitation', clinicInvitationSchema, { list: true })
  @ErrorResponses(401, 403)
  invitations(@CurrentUser() user: TokenPayload): Promise<ClinicInvitation[]> {
    return this.team.invitations(user.sub);
  }

  @Roles('clinic')
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('clinics/mine/invitations')
  @ApiOperation({
    summary: 'Invite someone to the team by email',
    description:
      'The link points to the requesting site (its Origin must be allowed), works once and expires in 7 days. Emails that already have an account are refused.',
  })
  @ZodBody('CreateClinicInvitation', createClinicInvitationSchema)
  @ZodResponse('ClinicInvitation', clinicInvitationSchema, { status: 201 })
  @ErrorResponses(400, 401, 403, 409, 429, 503)
  invite(
    @Req() req: Request,
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(createClinicInvitationSchema))
    data: CreateClinicInvitation,
  ): Promise<ClinicInvitation> {
    const origin = requireAllowedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    return this.team.invite(user.sub, data, origin);
  }

  @Roles('clinic')
  @Post('clinics/mine/invitations/:invitationId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw a pending invitation' })
  @ApiParam({ name: 'invitationId', description: 'Invitation id (UUID)' })
  @ApiNoContentResponse({ description: 'Withdrawn' })
  @ErrorResponses(401, 403, 404)
  async revokeInvitation(
    @CurrentUser() user: TokenPayload,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    await this.team.revokeInvitation(user.sub, invitationId);
  }

  @Public()
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('clinic-signup-links/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'See the clinic, email and plan of a sign-up link, before registering',
  })
  @ZodBody('InvitationToken', invitationTokenSchema)
  @ZodResponse('ClinicSignupPreview', clinicSignupPreviewSchema)
  @ErrorResponses(400, 429)
  previewSignupLink(
    @Body(new ZodValidationPipe(invitationTokenSchema)) data: InvitationToken,
  ): Promise<ClinicSignupPreview> {
    return this.signupLinks.preview(data.token);
  }

  @Public()
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @Post('clinic-invitations/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'See which clinic an invitation is from, before accepting it',
  })
  @ZodBody('InvitationToken', invitationTokenSchema)
  @ZodResponse('ClinicInvitationPreview', clinicInvitationPreviewSchema)
  @ErrorResponses(400, 403, 429)
  previewInvitation(
    @Body(new ZodValidationPipe(invitationTokenSchema)) data: InvitationToken,
  ): Promise<ClinicInvitationPreview> {
    return this.team.preview(data.token);
  }
}
