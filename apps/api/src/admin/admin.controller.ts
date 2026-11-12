import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  adminClinicSchema,
  adminClinicsQuerySchema,
  clinicSchema,
  suspendClinicSchema,
  type AdminClinic,
  type AdminClinicsQuery,
  type Clinic,
  type SuspendClinic,
  type TokenPayload,
} from '@vetify/types';
import type { Request } from 'express';
import type { Env } from '../config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { trustedOrigin } from '../common/http/origin.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller({ path: 'admin/clinics', version: '1' })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List clinics, optionally filtered by verification',
  })
  @ApiQuery({ name: 'verified', required: false, enum: ['true', 'false'] })
  @ZodResponse('AdminClinic', adminClinicSchema, { list: true })
  @ErrorResponses(401, 403)
  list(
    @Query(new ZodValidationPipe(adminClinicsQuerySchema))
    query: AdminClinicsQuery,
  ): Promise<AdminClinic[]> {
    return this.admin.clinics(query);
  }

  @Post(':clinicId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a clinic as verified so it can issue link codes',
    description:
      "Records the admin and emails the clinic's administrators, with a link to the requesting site when its Origin is allowed. Verifying a verified clinic changes nothing and sends nothing.",
  })
  @ApiParam({ name: 'clinicId', description: 'Clinic id (UUID)' })
  @ZodResponse('AdminClinic', adminClinicSchema)
  @ErrorResponses(401, 403, 404)
  verify(
    @Req() req: Request,
    @CurrentUser() admin: TokenPayload,
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
  ): Promise<AdminClinic> {
    const origin = trustedOrigin(
      req,
      this.config.get('ALLOWED_ORIGINS', { infer: true }),
    );
    return this.admin.verify(admin, clinicId, origin);
  }

  @Post(':clinicId/unverify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Withdraw verification: the clinic can no longer issue link codes',
  })
  @ApiParam({ name: 'clinicId', description: 'Clinic id (UUID)' })
  @ZodResponse('AdminClinic', adminClinicSchema)
  @ErrorResponses(401, 403, 404)
  unverify(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
  ): Promise<AdminClinic> {
    return this.admin.unverify(clinicId);
  }

  @Post(':clinicId/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend a clinic in an emergency',
    description:
      'Its permissions stop counting and its staff sessions are revoked at once. ' +
      'Reversible with reinstate; both are audited.',
  })
  @ApiParam({ name: 'clinicId', description: 'Clinic id (UUID)' })
  @ZodBody('SuspendClinic', suspendClinicSchema)
  @ZodResponse('Clinic', clinicSchema)
  @ErrorResponses(400, 401, 403, 404)
  suspend(
    @CurrentUser() admin: TokenPayload,
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body(new ZodValidationPipe(suspendClinicSchema)) data: SuspendClinic,
  ): Promise<Clinic> {
    return this.admin.suspend(admin, clinicId, data);
  }

  @Post(':clinicId/reinstate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lift a suspension: the clinic gets its permissions back',
  })
  @ApiParam({ name: 'clinicId', description: 'Clinic id (UUID)' })
  @ZodResponse('Clinic', clinicSchema)
  @ErrorResponses(400, 401, 403, 404)
  reinstate(
    @CurrentUser() admin: TokenPayload,
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
  ): Promise<Clinic> {
    return this.admin.reinstate(admin, clinicId);
  }
}
