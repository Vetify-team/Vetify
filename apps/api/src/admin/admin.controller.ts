import {
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
  type AdminClinicsQuery,
  type Clinic,
} from '@vetify/types';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ErrorResponses, ZodResponse } from '../common/openapi/zod-openapi.js';
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
}
