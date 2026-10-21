import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { CreateProductUnitDto } from './dto/create-product-unit.dto.js';
import { ProductUnitDto } from './dto/product.dto.js';
import { UpdateProductUnitDto } from './dto/update-product-unit.dto.js';
import { ProductUnitsService } from './product-units.service.js';

@ApiTags('product-units')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('products/:productId/units')
export class ProductUnitsController {
  constructor(private readonly units: ProductUnitsService) {}

  @RequirePermissions(Permission.PRODUCTS_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Add a unit to a product',
    description:
      'Owner and stock keeper only. The conversion factor is positive and cannot be 1; the base unit stays factor 1.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiBody({ type: CreateProductUnitDto })
  @ApiCreatedResponse({ type: ProductUnitDto })
  @ApiBadRequestResponse({
    description: 'The request body failed validation or the product is archived.',
  })
  @ApiConflictResponse({ description: 'A unit with this name already exists for this product.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage products.' })
  @ApiNotFoundResponse({ description: 'No product with this id exists in the caller depot.' })
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: CreateProductUnitDto,
  ) {
    return this.units.create(principal, productId, dto);
  }

  @RequirePermissions(Permission.PRODUCTS_MANAGE)
  @Patch(':unitId')
  @ApiOperation({
    summary: 'Edit a unit',
    description:
      'Owner and stock keeper only. The base unit can only be renamed and must keep factor 1. Additional units can be renamed or given a new positive factor different from 1.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'unitId', format: 'uuid' })
  @ApiBody({ type: UpdateProductUnitDto })
  @ApiOkResponse({ type: ProductUnitDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation or is empty.' })
  @ApiConflictResponse({ description: 'A unit with this name already exists for this product.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage products.' })
  @ApiNotFoundResponse({ description: 'The product or unit does not exist in the caller depot.' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
    @Body() dto: UpdateProductUnitDto,
  ) {
    return this.units.update(principal, productId, unitId, dto);
  }

  @RequirePermissions(Permission.PRODUCTS_MANAGE)
  @HttpCode(200)
  @Post(':unitId/archive')
  @ApiOperation({
    summary: 'Archive a product unit',
    description: 'Owner and stock keeper only. The base unit cannot be archived.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiParam({ name: 'unitId', format: 'uuid' })
  @ApiOkResponse({ type: ProductUnitDto })
  @ApiBadRequestResponse({ description: 'The base unit cannot be archived.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage products.' })
  @ApiNotFoundResponse({ description: 'The product or unit does not exist in the caller depot.' })
  archive(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('unitId', new ParseUUIDPipe()) unitId: string,
  ) {
    return this.units.archive(principal, productId, unitId);
  }
}
