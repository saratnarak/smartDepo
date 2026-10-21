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
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto.js';
import { PaginatedSuppliersDto, SupplierDto } from './dto/supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';

@ApiTags('suppliers')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @RequirePermissions(Permission.SUPPLIERS_READ)
  @Get()
  @ApiOperation({
    summary: 'List suppliers',
    description:
      'Owner and stock keeper only. Supports name/contact/phone search, active/archived filtering, pagination, and sorting.',
  })
  @ApiOkResponse({ type: PaginatedSuppliersDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read suppliers.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListSuppliersQueryDto) {
    return this.suppliers.list(principal, query);
  }

  @RequirePermissions(Permission.SUPPLIERS_READ)
  @Get(':id')
  @ApiOperation({ summary: 'Read a supplier' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SupplierDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read suppliers.' })
  @ApiNotFoundResponse({ description: 'No supplier with this id exists in the caller depot.' })
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.suppliers.get(principal, id);
  }

  @RequirePermissions(Permission.SUPPLIERS_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Create a supplier',
    description: 'Owner and stock keeper only. Supplier names are unique per depot.',
  })
  @ApiBody({ type: CreateSupplierDto })
  @ApiCreatedResponse({ type: SupplierDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation.' })
  @ApiConflictResponse({ description: 'A supplier with this name already exists.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage suppliers.' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(principal, dto);
  }

  @RequirePermissions(Permission.SUPPLIERS_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a supplier',
    description: 'Owner and stock keeper only. Send at least one field.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateSupplierDto })
  @ApiOkResponse({ type: SupplierDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation or is empty.' })
  @ApiConflictResponse({ description: 'A supplier with this name already exists.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage suppliers.' })
  @ApiNotFoundResponse({ description: 'No supplier with this id exists in the caller depot.' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(principal, id, dto);
  }

  @RequirePermissions(Permission.SUPPLIERS_MANAGE)
  @HttpCode(200)
  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archive a supplier',
    description:
      'Owner and stock keeper only. Archived suppliers stay on old purchases but cannot be used for new purchases.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SupplierDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage suppliers.' })
  @ApiNotFoundResponse({ description: 'No supplier with this id exists in the caller depot.' })
  archive(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.suppliers.archive(principal, id);
  }
}
