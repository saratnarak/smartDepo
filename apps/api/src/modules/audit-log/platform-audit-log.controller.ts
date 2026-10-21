import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import { AuditLogService } from './audit-log.service.js';
import { PaginatedAuditLogDto } from './audit-log.controller.js';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto.js';

@ApiTags('audit-log')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('platform')
export class PlatformAuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @RequirePermissions(Permission.PLATFORM_AUDIT_LOG_READ)
  @Get('audit-log')
  @ApiOperation({
    summary: 'The audit log of the platform',
    description:
      'Platform Admin only. The entries that are not tied to a depot, like the approval of a depot or a login of a Platform Admin. The log cannot be changed or removed.',
  })
  @ApiOkResponse({ type: PaginatedAuditLogDto })
  @ApiBadRequestResponse({ description: 'A filter or the paging failed validation.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not a Platform Admin.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListAuditLogQueryDto) {
    return this.auditLog.listPlatformEntries(principal, query);
  }
}
