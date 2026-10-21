import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { DepotSettingsService } from './depot-settings.service.js';
import { DepotSettingsDto } from './dto/depot-settings.dto.js';
import { UpdateDepotSettingsDto } from './dto/update-depot-settings.dto.js';

@ApiTags('depot')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('depot')
export class DepotSettingsController {
  constructor(private readonly settings: DepotSettingsService) {}

  @RequirePermissions(Permission.DEPOT_READ)
  @Get('settings')
  @ApiOperation({
    summary: 'Read your depot settings',
    description:
      'Every depot role can read the display settings it needs: name, address, currency, default language, and invoice footer.',
  })
  @ApiOkResponse({ type: DepotSettingsDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiNotFoundResponse({ description: 'The caller depot no longer exists.' })
  get(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.settings.get(principal);
  }

  @RequirePermissions(Permission.DEPOT_MANAGE)
  @Patch('settings')
  @ApiOperation({
    summary: 'Update your depot settings',
    description:
      'Owner only. Updates the depot name, address, currency, default language, and invoice footer, and writes a DEPOT_SETTINGS_UPDATED audit entry.',
  })
  @ApiBody({ type: UpdateDepotSettingsDto })
  @ApiOkResponse({ type: DepotSettingsDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation or is empty.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can change depot settings.' })
  @ApiNotFoundResponse({ description: 'The caller depot no longer exists.' })
  update(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: UpdateDepotSettingsDto) {
    return this.settings.update(principal, dto);
  }
}
