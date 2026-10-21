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
import { CancelPurchaseDto } from './dto/cancel-purchase.dto.js';
import { CreatePurchaseDto } from './dto/create-purchase.dto.js';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto.js';
import { PaginatedPurchasesDto, PurchaseDto } from './dto/purchase.dto.js';
import { UpdatePurchaseDto } from './dto/update-purchase.dto.js';
import { PurchasesService } from './purchases.service.js';

@ApiTags('purchases')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @RequirePermissions(Permission.PURCHASES_READ)
  @Get()
  @ApiOperation({
    summary: 'List purchases',
    description:
      'Owner and stock keeper only. Filter by status, supplier, reference, and created date range.',
  })
  @ApiOkResponse({ type: PaginatedPurchasesDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read purchases.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListPurchasesQueryDto) {
    return this.purchases.list(principal, query);
  }

  @RequirePermissions(Permission.PURCHASES_READ)
  @Get(':id')
  @ApiOperation({ summary: 'Read a purchase with its lines' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PurchaseDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read purchases.' })
  @ApiNotFoundResponse({ description: 'No purchase with this id exists in the caller depot.' })
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.purchases.get(principal, id);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Create a draft purchase',
    description:
      'Owner and stock keeper only. Lines carry product, unit, quantity, and unit cost. Batch-tracked products require a batch number and expiry date. The reference number is generated when omitted.',
  })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiCreatedResponse({ type: PurchaseDto })
  @ApiBadRequestResponse({
    description: 'The request body failed validation or a product is archived.',
  })
  @ApiConflictResponse({ description: 'The reference number already exists.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage purchases.' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreatePurchaseDto) {
    return this.purchases.create(principal, dto);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a draft purchase',
    description:
      'Owner and stock keeper only. Received and cancelled purchases cannot be edited; use a stock adjustment for corrections.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdatePurchaseDto })
  @ApiOkResponse({ type: PurchaseDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, the body is empty, or the purchase is not a draft.',
  })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage purchases.' })
  @ApiNotFoundResponse({ description: 'No purchase with this id exists in the caller depot.' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    return this.purchases.update(principal, id, dto);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @HttpCode(200)
  @Post(':id/receive')
  @ApiOperation({
    summary: 'Receive a draft purchase',
    description:
      'Owner and stock keeper only. Runs in one transaction: claims the draft, creates PURCHASE movements, saves batches, and updates each product last cost per base unit.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PurchaseDto })
  @ApiBadRequestResponse({
    description: 'The purchase is not a draft or a tracked line has no batch.',
  })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage purchases.' })
  @ApiNotFoundResponse({ description: 'No purchase with this id exists in the caller depot.' })
  receive(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.purchases.receive(principal, id);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @HttpCode(200)
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a draft purchase',
    description:
      'Owner and stock keeper only. Only a draft can be cancelled; received purchases are immutable.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CancelPurchaseDto, required: false })
  @ApiOkResponse({ type: PurchaseDto })
  @ApiBadRequestResponse({ description: 'The purchase is not a draft.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage purchases.' })
  @ApiNotFoundResponse({ description: 'No purchase with this id exists in the caller depot.' })
  cancel(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelPurchaseDto,
  ) {
    return this.purchases.cancel(principal, id, dto);
  }
}
