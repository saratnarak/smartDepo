import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Permission } from '../../common/auth/permissions.js';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator.js';
import { SWAGGER_SECURITY_SCHEME } from '../../common/bootstrap/configure-swagger.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { ChangeDepotPlanDto } from './dto/change-plan.dto.js';
import { DepotPlanViewDto, PlanViewDto } from './dto/plan-view.dto.js';
import { PlansService } from './plans.service.js';

@ApiTags('platform-admin')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('platform')
export class PlatformPlansController {
  constructor(private readonly plans: PlansService) {}

  @RequirePermissions(Permission.PLATFORM_PLANS_READ)
  @Get('plans')
  @ApiOperation({
    summary: 'List the subscription plans',
    description:
      'Platform Admin only. The price of a plan is for display only: the billing is simulated and nothing is ever charged.',
  })
  @ApiOkResponse({ type: [PlanViewDto] })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not a Platform Admin.' })
  listPlans(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.plans.listPlans(principal);
  }

  @RequirePermissions(Permission.PLATFORM_PLANS_MANAGE)
  @Patch('depots/:id/plan')
  @ApiOperation({
    summary: 'Move a depot to another plan',
    description:
      'Platform Admin only. The old subscription is closed and a new one is started. The change is written to the audit log of the depot.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ChangeDepotPlanDto })
  @ApiOkResponse({ type: DepotPlanViewDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not a Platform Admin.' })
  @ApiNotFoundResponse({ description: 'No depot or plan with that id or code exists.' })
  changePlan(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) depotId: string,
    @Body() dto: ChangeDepotPlanDto,
  ) {
    return this.plans.changeDepotPlan(principal, depotId, dto.planCode);
  }
}
