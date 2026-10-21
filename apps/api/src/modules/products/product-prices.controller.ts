import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { PriceType } from '../../generated/prisma/enums.js';
import { PaginatedPriceHistoryDto, PriceHistoryQueryDto } from './dto/price-history.dto.js';
import { PriceDto } from './dto/price.dto.js';
import { SetPriceDto } from './dto/set-price.dto.js';
import { ProductPricesService } from './product-prices.service.js';

@ApiTags('prices')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('products/:productId/units/:unitId/prices')
export class ProductPricesController {
  constructor(private readonly prices: ProductPricesService) {}

  @RequirePermissions(Permission.PRODUCTS_READ)
  @Get()
  @ApiOperation({
    summary: 'Read price history for a product unit',
    description:
      'Read-only history with who changed the price, when, and the old and new amount. OWNER, STOCK_KEEPER, and SALES can read it.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'unitId', format: 'uuid' })
  @ApiOkResponse({ type: PaginatedPriceHistoryDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read products.' })
  @ApiNotFoundResponse({ description: 'The product or unit does not exist in the caller depot.' })
  history(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Query() query: PriceHistoryQueryDto,
  ) {
    return this.prices.history(principal, productId, { ...query, unitId });
  }

  @RequirePermissions(Permission.PRICES_MANAGE)
  @Put(':type')
  @ApiOperation({
    summary: 'Set a retail or wholesale price',
    description:
      'Owner only. Creates or changes the price for a product unit, writes a price_history row on every actual change, and records a PRICE_CHANGED audit entry.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'unitId', format: 'uuid' })
  @ApiParam({ name: 'type', enum: PriceType })
  @ApiBody({ type: SetPriceDto })
  @ApiOkResponse({ type: PriceDto })
  @ApiBadRequestResponse({
    description: 'The amount failed validation or the product/unit is archived.',
  })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can change prices.' })
  @ApiNotFoundResponse({ description: 'The product or unit does not exist in the caller depot.' })
  setPrice(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Param('type', new ParseEnumPipe(PriceType)) type: PriceType,
    @Body() dto: SetPriceDto,
  ) {
    return this.prices.setPrice(principal, productId, unitId, type, dto);
  }
}
