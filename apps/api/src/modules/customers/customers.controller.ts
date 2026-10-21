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
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { CustomerDto, CustomerStatementDto, PaginatedCustomersDto } from './dto/customer.dto.js';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CustomersService } from './customers.service.js';

@ApiTags('customers')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermissions(Permission.CUSTOMERS_READ)
  @Get()
  @ApiOperation({
    summary: 'List customers',
    description:
      'Owner and sales only. Supports name, phone, and email search, a customer type filter, an active or archived filter, pagination, and sorting. The balance is derived from invoices and payments.',
  })
  @ApiOkResponse({ type: PaginatedCustomersDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read customers.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListCustomersQueryDto) {
    return this.customers.list(principal, query);
  }

  @RequirePermissions(Permission.CUSTOMERS_READ)
  @Get(':id')
  @ApiOperation({ summary: 'Read a customer with the derived balance' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read customers.' })
  @ApiNotFoundResponse({ description: 'No customer with this id exists in the caller depot.' })
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customers.get(principal, id);
  }

  @RequirePermissions(Permission.CUSTOMERS_READ)
  @Get(':id/statement')
  @ApiOperation({
    summary: 'Customer statement',
    description: 'Invoices, payments, and the running balance of one customer.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerStatementDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read customers.' })
  @ApiNotFoundResponse({ description: 'No customer with this id exists in the caller depot.' })
  statement(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customers.statement(principal, id);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Create a customer',
    description:
      'Owner and sales only. The customer type decides whether invoices use the retail or the wholesale price.',
  })
  @ApiBody({ type: CreateCustomerDto })
  @ApiCreatedResponse({ type: CustomerDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage customers.' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateCustomerDto) {
    return this.customers.create(principal, dto);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a customer',
    description: 'Owner and sales only. Send at least one field.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiOkResponse({ type: CustomerDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation or is empty.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage customers.' })
  @ApiNotFoundResponse({ description: 'No customer with this id exists in the caller depot.' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(principal, id, dto);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @HttpCode(200)
  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archive a customer',
    description:
      'Owner and sales only. The customer stays on old invoices but cannot be invoiced again. The walk-in customer cannot be archived.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CustomerDto })
  @ApiBadRequestResponse({ description: 'The customer is the walk-in customer.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage customers.' })
  @ApiNotFoundResponse({ description: 'No customer with this id exists in the caller depot.' })
  archive(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customers.archive(principal, id);
  }
}
