import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Permission } from '../../common/auth/permissions.js';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator.js';
import { SWAGGER_SECURITY_SCHEME } from '../../common/bootstrap/configure-swagger.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardDto } from './dto/report.dto.js';

@ApiTags('dashboard')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermissions(Permission.DASHBOARD_VIEW)
  @Get()
  @ApiOperation({
    summary: 'Dashboard of the depot',
    description:
      'The cards and the chart data of the depot. The owner sees everything, the sales staff the sales part, and the stock keeper the inventory part.',
  })
  @ApiOkResponse({ type: DashboardDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read the dashboard.' })
  build(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.dashboard.build(principal);
  }
}
