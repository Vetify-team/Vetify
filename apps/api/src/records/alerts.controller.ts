import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { alertSchema, type Alert, type TokenPayload } from '@vetify/types';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ErrorResponses, ZodResponse } from '../common/openapi/zod-openapi.js';
import { VaccinationStatusService } from './vaccination-status.service.js';

@ApiTags('records')
@ApiBearerAuth()
@Roles('owner', 'clinic')
@Controller({ path: 'alerts', version: '1' })
export class AlertsController {
  constructor(private readonly status: VaccinationStatusService) {}

  @Get()
  @ApiOperation({
    summary:
      "Overdue and upcoming doses of the owner's pets, or of the clinic's patients",
  })
  @ZodResponse('Alert', alertSchema, { list: true })
  @ErrorResponses(401, 403)
  list(@CurrentUser() user: TokenPayload): Promise<Alert[]> {
    return this.status.alerts(user);
  }
}
