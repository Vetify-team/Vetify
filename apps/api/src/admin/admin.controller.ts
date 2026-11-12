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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  adminClinicsQuerySchema,
  clinicSchema,
  suspendClinicSchema,
  type AdminClinicsQuery,
  type Clinic,
  type SuspendClinic,
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
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller({ path: 'admin/clinics', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @ApiOperation({
    summary: 'List clinics, optionally filtered by verification',
  })
  @ApiQuery({ name: 'verified', required: false, enum: ['true', 'false'] })
  @ZodResponse('Clinic', clinicSchema, { list: true })
  @ErrorResponses(401, 403)
  list(
    @Query(new ZodValidationPipe(adminClinicsQuerySchema))
    query: AdminClinicsQuery,
  ): Promise<Clinic[]> {
    return this.admin.clinics(query);
  }

  @Post(':clinicId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a clinic as verified so it can issue link codes',
  })
  @ApiParam({ name: 'clinicId', description: 'Clinic id (UUID)' })
  @ZodResponse('Clinic', clinicSchema)
  @ErrorResponses(401, 403, 404)
  verify(@Param('clinicId', ParseUUIDPipe) clinicId: string): Promise<Clinic> {
    return this.admin.setVerified(clinicId, true);
  }

  @Post(':clinicId/unverify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Withdraw verification: the clinic can no longer issue link codes',
  })
  @ApiParam({ name: 'clinicId', description: 'Clinic id (UUID)' })
  @ZodResponse('Clinic', clinicSchema)
  @ErrorResponses(401, 403, 404)
  unverify(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
  ): Promise<Clinic> {
    return this.admin.setVerified(clinicId, false);
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
