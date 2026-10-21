import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
import { ConfirmImageDto } from './dto/confirm-image.dto.js';
import { PresignUploadDto } from './dto/presign-upload.dto.js';
import {
  ConfirmImageResponseDto,
  PresignedReadResponseDto,
  PresignedUploadResponseDto,
} from './dto/storage-response.dto.js';
import { StorageService } from './storage.service.js';

@ApiTags('storage')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @HttpCode(200)
  @RequirePermissions(Permission.STORAGE_LOGO_MANAGE)
  @Post('logo/upload-url')
  @ApiOperation({ summary: 'Request a presigned depot logo upload URL' })
  @ApiBody({ type: PresignUploadDto })
  @ApiOkResponse({ type: PresignedUploadResponseDto })
  @ApiBadRequestResponse({ description: 'The content type is not JPEG, PNG, or WebP.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can upload a logo.' })
  logoUpload(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: PresignUploadDto) {
    return this.storage.presignLogoUpload(principal, dto);
  }

  @HttpCode(200)
  @RequirePermissions(Permission.STORAGE_LOGO_MANAGE)
  @Post('logo/read-url')
  @ApiOperation({ summary: 'Request a presigned depot logo read URL' })
  @ApiOkResponse({ type: PresignedReadResponseDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can read the logo.' })
  @ApiNotFoundResponse({ description: 'No logo has been uploaded.' })
  logoRead(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.storage.presignLogoRead(principal);
  }

  @HttpCode(200)
  @RequirePermissions(Permission.STORAGE_LOGO_MANAGE)
  @Post('logo/confirm')
  @ApiOperation({ summary: 'Validate and save a depot logo' })
  @ApiBody({ type: ConfirmImageDto })
  @ApiOkResponse({ type: ConfirmImageResponseDto })
  @ApiBadRequestResponse({ description: 'The object is missing, too large, or not a valid image.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can set the logo.' })
  logoConfirm(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: ConfirmImageDto) {
    return this.storage.confirmLogo(principal, dto);
  }

  @HttpCode(200)
  @RequirePermissions(Permission.STORAGE_PRODUCT_IMAGE_MANAGE)
  @Post('products/:productId/image-upload-url')
  @ApiOperation({ summary: 'Request a presigned product image upload URL' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiBody({ type: PresignUploadDto })
  @ApiOkResponse({ type: PresignedUploadResponseDto })
  @ApiBadRequestResponse({ description: 'The content type is not JPEG, PNG, or WebP.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage product images.' })
  @ApiNotFoundResponse({ description: 'The product does not exist in the caller depot.' })
  productUpload(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: PresignUploadDto,
  ) {
    return this.storage.presignProductUpload(principal, productId, dto);
  }

  @HttpCode(200)
  @RequirePermissions(Permission.STORAGE_PRODUCT_IMAGE_MANAGE)
  @Post('products/:productId/image-read-url')
  @ApiOperation({ summary: 'Request a presigned product image read URL' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiOkResponse({ type: PresignedReadResponseDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read product images.' })
  @ApiNotFoundResponse({
    description: 'The product or its image does not exist in the caller depot.',
  })
  productRead(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ) {
    return this.storage.presignProductRead(principal, productId);
  }

  @HttpCode(200)
  @RequirePermissions(Permission.STORAGE_PRODUCT_IMAGE_MANAGE)
  @Post('products/:productId/image-confirm')
  @ApiOperation({ summary: 'Validate and save a product image' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiBody({ type: ConfirmImageDto })
  @ApiOkResponse({ type: ConfirmImageResponseDto })
  @ApiBadRequestResponse({ description: 'The object is missing, too large, or not a valid image.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage product images.' })
  @ApiNotFoundResponse({ description: 'The product does not exist in the caller depot.' })
  productConfirm(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: ConfirmImageDto,
  ) {
    return this.storage.confirmProduct(principal, productId, dto);
  }
}
