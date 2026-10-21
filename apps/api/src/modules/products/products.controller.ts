import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { PaginatedProductsDto, ProductDto } from './dto/product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @RequirePermissions(Permission.PRODUCTS_READ)
  @Get()
  @ApiOperation({
    summary: 'List products in your depot',
    description:
      'Every role with product read access can list products. Supports name/SKU search, category and active/archived filters, pagination, and sorting.',
  })
  @ApiOkResponse({ type: PaginatedProductsDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read products.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListProductsQueryDto) {
    return this.products.list(principal, query);
  }

  @RequirePermissions(Permission.PRODUCTS_READ)
  @Get(':id')
  @ApiOperation({
    summary: 'Read a product',
    description:
      'Returns the product, its base unit, all units, and current retail/wholesale prices.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read products.' })
  @ApiNotFoundResponse({ description: 'No product with this id exists in the caller depot.' })
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.products.get(principal, id);
  }

  @RequirePermissions(Permission.PRODUCTS_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Owner and stock keeper only. Creates the product with its base unit and optional additional units. SKU is unique per depot.',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiCreatedResponse({ type: ProductDto })
  @ApiBadRequestResponse({
    description: 'The request body failed validation or a unit is invalid.',
  })
  @ApiConflictResponse({ description: 'The SKU or a unit name already exists.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage products.' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateProductDto) {
    return this.products.create(principal, dto);
  }

  @RequirePermissions(Permission.PRODUCTS_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a product',
    description:
      'Owner and stock keeper only. Changes name, SKU, description, category, reorder level, or batch tracking. Archived products cannot be used for new purchases or invoices.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateProductDto })
  @ApiOkResponse({ type: ProductDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation or is empty.' })
  @ApiConflictResponse({ description: 'The SKU already exists in this depot.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage products.' })
  @ApiNotFoundResponse({ description: 'No product with this id exists in the caller depot.' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(principal, id, dto);
  }

  @RequirePermissions(Permission.PRODUCTS_MANAGE)
  @HttpCode(200)
  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archive a product',
    description:
      'Owner and stock keeper only. Archived products remain readable for old records but cannot be used in new invoices or purchases.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage products.' })
  @ApiNotFoundResponse({ description: 'No product with this id exists in the caller depot.' })
  archive(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.products.archive(principal, id);
  }
}
