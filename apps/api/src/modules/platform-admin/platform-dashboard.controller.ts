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
import { PlatformDashboardDto } from './dto/platform-dashboard.dto.js';
import { PlatformAdminService } from './platform-admin.service.js';

@ApiTags('platform-admin')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('platform')
export class PlatformDashboardController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @RequirePermissions(Permission.PLATFORM_DASHBOARD_VIEW)
  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard of the platform',
    description:
      'The depots that registered over time, the active depots, the depots per plan, and the approvals that wait. Only the Platform Admin sees it.',
  })
  @ApiOkResponse({ type: PlatformDashboardDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not a Platform Admin.' })
  dashboard(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.platformAdmin.dashboard(principal);
  }
}
