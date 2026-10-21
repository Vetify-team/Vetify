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
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  accessLogPageSchema,
  accessLogQuerySchema,
  grantPermissionSchema,
  permissionSchema,
  permissionWithClinicSchema,
  type AccessLogPage,
  type AccessLogQuery,
  type GrantPermission,
  type Permission,
  type PermissionWithClinic,
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
import { PermissionsService } from './permissions.service.js';

@ApiTags('permissions')
@ApiBearerAuth()
@ApiParam({ name: 'petId', description: 'Pet id (UUID)' })
@Roles('owner')
@Controller({ path: 'pets/:petId', version: '1' })
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('permissions')
  @LogAccess('view_permissions', { dedupe: true })
  @ApiOperation({
    summary: 'Clinics with access to the pet (active and revoked)',
  })
  @ZodResponse('PermissionWithClinic', permissionWithClinicSchema, {
    list: true,
  })
  @ErrorResponses(401, 403, 404)
  list(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<PermissionWithClinic[]> {
    return this.permissions.list(user, petId);
  }

  @Post('permissions')
  @Throttle({ general: { limit: 10, ttl: 60_000 } })
  @LogAccess('grant_permission')
  @ApiOperation({
    summary: 'Grant a clinic access with the link code it shows in person',
    description: 'The code is single use. The clinic must be verified.',
  })
  @ZodBody('GrantPermission', grantPermissionSchema)
  @ZodResponse('PermissionWithClinic', permissionWithClinicSchema, {
    status: 201,
  })
  @ErrorResponses(400, 401, 403, 404, 429)
  grant(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(grantPermissionSchema)) data: GrantPermission,
  ): Promise<PermissionWithClinic> {
    return this.permissions.grant(user, petId, data);
  }

  @Post('permissions/:permissionId/revoke')
  @HttpCode(HttpStatus.OK)
  @LogAccess('revoke_permission')
  @ApiOperation({ summary: 'Revoke a permission; access is cut immediately' })
  @ApiParam({ name: 'permissionId', description: 'Permission id (UUID)' })
  @ZodResponse('Permission', permissionSchema)
  @ErrorResponses(401, 403, 404)
  revoke(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<Permission> {
    return this.permissions.revoke(user, petId, permissionId);
  }

  @Post('permissions/:permissionId/restore')
  @HttpCode(HttpStatus.OK)
  @LogAccess('restore_permission')
  @ApiOperation({ summary: 'Give a previously linked clinic its access back' })
  @ApiParam({ name: 'permissionId', description: 'Permission id (UUID)' })
  @ZodResponse('Permission', permissionSchema)
  @ErrorResponses(401, 403, 404)
  restore(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<Permission> {
    return this.permissions.restore(user, petId, permissionId);
  }

  @Get('access-log')
  @LogAccess('view_access_log', { dedupe: true })
  @ApiOperation({
    summary: 'Who accessed the record and when (newest first, paginated)',
  })
  @ZodResponse('AccessLogPage', accessLogPageSchema)
  @ErrorResponses(400, 401, 403, 404)
  accessLog(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query(new ZodValidationPipe(accessLogQuerySchema)) query: AccessLogQuery,
  ): Promise<AccessLogPage> {
    return this.permissions.accessLog(user, petId, query);
  }
}
