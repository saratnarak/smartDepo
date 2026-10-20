import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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
import { DepotAdminViewDto, PaginatedDepotsDto } from './dto/depot-admin-view.dto.js';
import { DepotReasonDto } from './dto/depot-reason.dto.js';
import { ListDepotsQueryDto } from './dto/list-depots-query.dto.js';
import { PlatformAdminService } from './platform-admin.service.js';

@ApiTags('platform-admin')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('platform/depots')
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @RequirePermissions(Permission.PLATFORM_DEPOTS_READ)
  @Get()
  @ApiOperation({
    summary: 'List depots across the platform',
    description:
      'The only cross-depot read path. Requires the PLATFORM_ADMIN role. Supports status filtering, sorting, and pagination.',
  })
  @ApiOkResponse({ type: PaginatedDepotsDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not a Platform Admin.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListDepotsQueryDto) {
    return this.platformAdmin.listDepots(principal, query);
  }

  @RequirePermissions(Permission.PLATFORM_DEPOTS_READ)
  @Get(':id')
  @ApiOperation({ summary: 'Get one depot by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DepotAdminViewDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not a Platform Admin.' })
  @ApiNotFoundResponse({ description: 'No depot exists with this id.' })
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) depotId: string,
  ) {
    return this.platformAdmin.getDepot(principal, depotId);
  }

  @RequirePermissions(Permission.PLATFORM_DEPOTS_MANAGE)
  @HttpCode(200)
  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve a pending or rejected depot',
    description: 'Sets the depot to APPROVED and writes a DEPOT_APPROVED audit entry.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DepotAdminViewDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage depots.' })
  @ApiNotFoundResponse({ description: 'No depot exists with this id.' })
  approve(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) depotId: string,
  ) {
    return this.platformAdmin.approveDepot(principal, depotId);
  }

  @RequirePermissions(Permission.PLATFORM_DEPOTS_MANAGE)
  @HttpCode(200)
  @Post(':id/reject')
  @ApiOperation({
    summary: 'Reject a pending depot registration',
    description: 'Stores the reason and writes a DEPOT_REJECTED audit entry.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: DepotReasonDto })
  @ApiOkResponse({ type: DepotAdminViewDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage depots.' })
  @ApiNotFoundResponse({ description: 'No depot exists with this id.' })
  @ApiConflictResponse({ description: 'Only a pending depot can be rejected.' })
  reject(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) depotId: string,
    @Body() dto: DepotReasonDto,
  ) {
    return this.platformAdmin.rejectDepot(principal, depotId, dto.reason);
  }

  @RequirePermissions(Permission.PLATFORM_DEPOTS_MANAGE)
  @HttpCode(200)
  @Post(':id/suspend')
  @ApiOperation({
    summary: 'Suspend an approved depot',
    description:
      'Stores the reason, blocks future logins and refreshes, and writes a DEPOT_SUSPENDED audit entry.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: DepotReasonDto })
  @ApiOkResponse({ type: DepotAdminViewDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage depots.' })
  @ApiNotFoundResponse({ description: 'No depot exists with this id.' })
  @ApiConflictResponse({ description: 'Only an approved or suspended depot can be suspended.' })
  suspend(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) depotId: string,
    @Body() dto: DepotReasonDto,
  ) {
    return this.platformAdmin.suspendDepot(principal, depotId, dto.reason);
  }
}
