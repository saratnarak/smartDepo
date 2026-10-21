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
import { CategoriesService } from './categories.service.js';
import { CategoryDto, PaginatedCategoriesDto } from './dto/category.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@ApiTags('categories')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @RequirePermissions(Permission.CATEGORIES_READ)
  @Get()
  @ApiOperation({
    summary: 'List categories in your depot',
    description:
      'Owner and stock keeper only. Supports case-insensitive name search, active/archived filtering, pagination, and sorting.',
  })
  @ApiOkResponse({ type: PaginatedCategoriesDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot read categories.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListCategoriesQueryDto) {
    return this.categories.list(principal, query);
  }

  @RequirePermissions(Permission.CATEGORIES_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Create a category',
    description: 'Owner and stock keeper only. Category names are unique per depot.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation.' })
  @ApiConflictResponse({ description: 'A category with this name already exists.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage categories.' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateCategoryDto) {
    return this.categories.create(principal, dto);
  }

  @RequirePermissions(Permission.CATEGORIES_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a category',
    description: 'Owner and stock keeper only. Category names are unique per depot.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOkResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation or is empty.' })
  @ApiConflictResponse({ description: 'A category with this name already exists.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage categories.' })
  @ApiNotFoundResponse({ description: 'No category with this id exists in the caller depot.' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(principal, categoryId, dto);
  }

  @RequirePermissions(Permission.CATEGORIES_MANAGE)
  @HttpCode(200)
  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archive a category',
    description:
      'Owner and stock keeper only. Archived categories stay on existing products but cannot be used for new or edited products.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CategoryDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller cannot manage categories.' })
  @ApiNotFoundResponse({ description: 'No category with this id exists in the caller depot.' })
  archive(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) categoryId: string,
  ) {
    return this.categories.archive(principal, categoryId);
  }
}
