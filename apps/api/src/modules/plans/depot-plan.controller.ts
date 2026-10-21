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
import { DepotPlanViewDto } from './dto/plan-view.dto.js';
import { PlansService } from './plans.service.js';

@ApiTags('plans')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('depot')
export class DepotPlanController {
  constructor(private readonly plans: PlansService) {}

  @RequirePermissions(Permission.PLAN_READ)
  @Get('plan')
  @ApiOperation({
    summary: 'The plan of your depot and the usage against its limits',
    description:
      'Owner only. Returns the active plan with its limits and the number of active staff accounts and products of the depot. The limits are the ones that are enforced when a staff account or a product is created.',
  })
  @ApiOkResponse({ type: DepotPlanViewDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can read the plan of the depot.' })
  getPlan(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.plans.getDepotPlan(principal);
  }
}
