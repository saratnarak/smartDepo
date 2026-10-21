import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
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
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto.js';
import { PaginatedPaymentsDto, PaymentDto } from './dto/payment.dto.js';
import { RecordPaymentDto } from './dto/record-payment.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('payments')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @RequirePermissions(Permission.PAYMENTS_READ)
  @Get()
  @ApiOperation({
    summary: 'List payments',
    description:
      'Owner and sales only. Filter by customer, method, and payment date. Every payment shows how it was allocated to invoices.',
  })
  @ApiOkResponse({ type: PaginatedPaymentsDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read payments.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListPaymentsQueryDto) {
    return this.payments.list(principal, query);
  }

  @RequirePermissions(Permission.PAYMENTS_READ)
  @Get(':id')
  @ApiOperation({ summary: 'Read a payment with its allocations' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read payments.' })
  @ApiNotFoundResponse({ description: 'No payment with this id exists in the caller depot.' })
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payments.get(principal, id);
  }

  @RequirePermissions(Permission.PAYMENTS_RECORD)
  @Post()
  @ApiOperation({
    summary: 'Record a payment',
    description:
      'Owner and sales only. Without allocations the oldest open invoices are paid first; money that is not allocated stays as customer credit. The payment, the allocations, the invoice payment status, and the audit entry are written in one transaction.',
  })
  @ApiBody({ type: RecordPaymentDto })
  @ApiCreatedResponse({ type: PaymentDto })
  @ApiBadRequestResponse({
    description:
      'Validation failed, an allocation is bigger than the open amount, or the invoice is voided.',
  })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot record payments.' })
  @ApiNotFoundResponse({ description: 'The customer does not exist in the caller depot.' })
  record(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: RecordPaymentDto) {
    return this.payments.record(principal, dto);
  }
}
