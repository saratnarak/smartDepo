import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Permission } from '../../common/auth/permissions.js';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator.js';
import { SWAGGER_SECURITY_SCHEME } from '../../common/bootstrap/configure-swagger.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { AgeingBucketDto, CreditOverviewDto, PaginatedOverdueDto } from './dto/credit.dto.js';
import { CreditService } from './credit.service.js';

class CreditPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

@ApiTags('credit')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('credit')
export class CreditController {
  constructor(private readonly credit: CreditService) {}

  @RequirePermissions(Permission.CREDIT_READ)
  @Get('overview')
  @ApiOperation({
    summary: 'Credit overview of the depot',
    description:
      'Owner and sales only. Total outstanding, overdue amount, the ageing buckets, and the money that has to be refunded from voided invoices.',
  })
  @ApiOkResponse({ type: CreditOverviewDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read the credit report.' })
  overview(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.credit.overview(principal);
  }

  @RequirePermissions(Permission.CREDIT_READ)
  @Get('overdue')
  @ApiOperation({
    summary: 'Overdue invoices',
    description: 'Owner and sales only. Invoices that are past their due date and still open.',
  })
  @ApiOkResponse({ type: PaginatedOverdueDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read the credit report.' })
  overdue(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: CreditPageQueryDto) {
    return this.credit.overdue(principal, query.page, query.pageSize);
  }

  @RequirePermissions(Permission.CREDIT_READ)
  @Get('ageing')
  @ApiOperation({
    summary: 'Ageing buckets',
    description: 'Owner and sales only. Open invoices grouped into 0-30, 31-60, and over 60 days.',
  })
  @ApiOkResponse({ type: AgeingBucketDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read the credit report.' })
  ageing(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.credit.ageing(principal);
  }
}
