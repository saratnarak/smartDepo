import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
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
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { InvoiceDocumentDto, InvoiceDto, PaginatedInvoicesDto } from './dto/invoice.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import { VoidInvoiceDto } from './dto/void-invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

@ApiTags('invoices')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @RequirePermissions(Permission.INVOICES_READ)
  @Get()
  @ApiOperation({
    summary: 'List invoices',
    description:
      'Owner and sales only. Filter by customer, invoice status, payment status, invoice number, and order date.',
  })
  @ApiOkResponse({ type: PaginatedInvoicesDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read invoices.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListInvoicesQueryDto) {
    return this.invoices.list(principal, query);
  }

  @RequirePermissions(Permission.INVOICES_READ)
  @Get(':id')
  @ApiOperation({ summary: 'Read an invoice with its lines and payments' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read invoices.' })
  @ApiNotFoundResponse({ description: 'No invoice with this id exists in the caller depot.' })
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.invoices.get(principal, id);
  }

  @RequirePermissions(Permission.INVOICES_READ)
  @Get(':id/document')
  @ApiOperation({
    summary: 'Invoice document data',
    description:
      'Everything needed to print an invoice: depot, customer, lines with readable units, totals, and payments. The PDF and the thermal receipt come later.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceDocumentDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read invoices.' })
  @ApiNotFoundResponse({ description: 'No invoice with this id exists in the caller depot.' })
  document(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.invoices.document(principal, id);
  }

  @RequirePermissions(Permission.INVOICES_CREATE)
  @Post()
  @ApiOperation({
    summary: 'Create an invoice',
    description:
      'Owner and sales only. The price comes from the product price of the customer type; only the owner may override a price. Stock is deducted, an optional checkout payment is applied, and the audit entry is written in one transaction.',
  })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiCreatedResponse({ type: InvoiceDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, a price is missing, the stock is not enough, or the credit limit blocks the invoice.',
  })
  @ApiConflictResponse({ description: 'The invoice number could not be reserved.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot create invoices.' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(principal, dto);
  }

  @RequirePermissions(Permission.INVOICES_VOID)
  @HttpCode(200)
  @Post(':id/void')
  @ApiOperation({
    summary: 'Void an invoice',
    description:
      'Owner only. The stock comes back with RETURN movements, the unpaid part leaves the customer balance, and money that was already paid is reported as a refund due. A voided invoice cannot receive payments.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: VoidInvoiceDto })
  @ApiOkResponse({ type: InvoiceDto })
  @ApiBadRequestResponse({ description: 'The invoice is already voided or the reason is missing.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot void invoices.' })
  @ApiNotFoundResponse({ description: 'No invoice with this id exists in the caller depot.' })
  void(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.invoices.void(principal, id, dto);
  }
}
