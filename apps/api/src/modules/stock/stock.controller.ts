import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
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
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { BatchAlertsQueryDto } from './dto/batch-alerts-query.dto.js';
import { DamageStockDto } from './dto/damage-stock.dto.js';
import { ListMovementsQueryDto } from './dto/list-movements-query.dto.js';
import { ListStockQueryDto } from './dto/list-stock-query.dto.js';
import {
  BatchAlertsDto,
  PaginatedStockDto,
  PaginatedStockMovementsDto,
  StockAdjustmentResultDto,
} from './dto/stock.dto.js';
import { StockService } from './stock.service.js';

@ApiTags('stock')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @RequirePermissions(Permission.STOCK_READ)
  @Get()
  @ApiOperation({
    summary: 'Current stock per product',
    description:
      'Derived from stock movements, in base units and readable units. Batch-tracked products also include current stock per batch. SALES can read stock; OWNER and STOCK_KEEPER can manage it.',
  })
  @ApiOkResponse({ type: PaginatedStockDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read stock.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListStockQueryDto) {
    return this.stock.list(principal, query);
  }

  @RequirePermissions(Permission.STOCK_READ)
  @Get('low-stock')
  @ApiOperation({
    summary: 'Products at or below their reorder level',
    description:
      'Returns active products whose derived stock is less than or equal to reorder level.',
  })
  @ApiOkResponse({ type: PaginatedStockDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read stock.' })
  lowStock(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListStockQueryDto) {
    return this.stock.lowStock(principal, query);
  }

  @RequirePermissions(Permission.STOCK_READ)
  @Get('movements')
  @ApiOperation({
    summary: 'Stock movement history',
    description:
      'Append-only ledger with product, type, date range, pagination, user, batch, and signed base-unit quantity.',
  })
  @ApiOkResponse({ type: PaginatedStockMovementsDto })
  @ApiBadRequestResponse({ description: 'A filter failed validation.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read stock.' })
  movements(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ListMovementsQueryDto,
  ) {
    return this.stock.movements(principal, query);
  }

  @RequirePermissions(Permission.STOCK_MANAGE)
  @Post('adjustments')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record a manual stock adjustment',
    description:
      'Owner and stock keeper only. The quantity is entered in any active product unit, converted to the base unit, and recorded with a required reason. Negative stock is blocked unless the depot allows it.',
  })
  @ApiBody({ type: AdjustStockDto })
  @ApiOkResponse({ type: StockAdjustmentResultDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, the product/unit is archived, or stock would become negative.',
  })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage stock.' })
  @ApiNotFoundResponse({ description: 'The product, unit, or batch does not exist in this depot.' })
  adjust(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: AdjustStockDto) {
    return this.stock.adjust(principal, dto);
  }

  @RequirePermissions(Permission.STOCK_MANAGE)
  @Post('damage')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record damaged stock',
    description:
      'Owner and stock keeper only. The entered positive quantity is converted to base units and stored as a negative DAMAGE movement with a required reason.',
  })
  @ApiBody({ type: DamageStockDto })
  @ApiOkResponse({ type: StockAdjustmentResultDto })
  @ApiBadRequestResponse({ description: 'Validation failed or stock would become negative.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage stock.' })
  @ApiNotFoundResponse({ description: 'The product, unit, or batch does not exist in this depot.' })
  damage(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: DamageStockDto) {
    return this.stock.damage(principal, dto);
  }

  @RequirePermissions(Permission.STOCK_READ)
  @Get('batches/alerts')
  @ApiOperation({
    summary: 'Near-expiry and expired batches',
    description:
      'Returns batches with positive stock whose expiry date is within the day threshold or already past. The default threshold is 30 days.',
  })
  @ApiOkResponse({ type: BatchAlertsDto })
  @ApiBadRequestResponse({ description: 'The day threshold failed validation.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read stock.' })
  batchAlerts(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: BatchAlertsQueryDto,
  ) {
    return this.stock.batchAlerts(principal, query);
  }
}
