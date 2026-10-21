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
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto.js';
import { AuditLogEntryDto } from './dto/audit-log-view.dto.js';

export class PaginatedAuditLogDto {
  data!: AuditLogEntryDto[];
  meta!: { page: number; pageSize: number; total: number };
}

@ApiTags('audit-log')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @RequirePermissions(Permission.AUDIT_LOG_READ)
  @Get()
  @ApiOperation({
    summary: 'The audit log of your depot',
    description:
      'Owner only. Every change of the depot with the user that made it, the values before and after the change, and the time. The log cannot be changed or removed. The entries of another depot are never part of the answer.',
  })
  @ApiOkResponse({ type: PaginatedAuditLogDto })
  @ApiBadRequestResponse({ description: 'A filter or the paging failed validation.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can read the audit log.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListAuditLogQueryDto) {
    return this.auditLog.listDepotEntries(principal, query);
  }
}
