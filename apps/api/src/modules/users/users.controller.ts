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
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto.js';
import {
  PaginatedStaffDto,
  ResetStaffPasswordResponseDto,
  StaffUserDto,
} from './dto/staff-user.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions(Permission.USERS_MANAGE)
  @Get()
  @ApiOperation({
    summary: 'List staff in your depot',
    description:
      'Owner only. Returns SALES, STOCK_KEEPER, and DELIVERY accounts of the caller depot with pagination, role and active filters, search, and sorting.',
  })
  @ApiOkResponse({ type: PaginatedStaffDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can manage staff.' })
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListUsersQueryDto) {
    return this.users.list(principal, query);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Create a staff account',
    description:
      'Owner only. Allowed roles are SALES, STOCK_KEEPER, and DELIVERY. The depot plan user limit is enforced.',
  })
  @ApiBody({ type: CreateStaffDto })
  @ApiCreatedResponse({ type: StaffUserDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation.' })
  @ApiConflictResponse({
    description:
      'The email or phone is already registered, or the plan user limit was reached (details.reason: PLAN_USER_LIMIT_REACHED).',
  })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the depot owner can manage staff.' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateStaffDto) {
    return this.users.create(principal, dto);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a staff account',
    description:
      'Owner only. Changes the name, email, phone, staff role, or active flag of a staff member in the caller depot. Reactivation respects the plan user limit.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateStaffDto })
  @ApiOkResponse({ type: StaffUserDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation or is empty.' })
  @ApiConflictResponse({ description: 'The email or phone is already registered.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not the owner or the target is an owner.' })
  @ApiNotFoundResponse({ description: 'No staff member with this id exists in the caller depot.' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.users.update(principal, staffId, dto);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @HttpCode(200)
  @Post(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a staff account',
    description:
      'Owner only. The account can no longer log in or refresh. Owners cannot deactivate themselves.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: StaffUserDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'Only the owner can deactivate staff; self is refused.' })
  @ApiNotFoundResponse({ description: 'No staff member with this id exists in the caller depot.' })
  deactivate(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) staffId: string,
  ) {
    return this.users.deactivate(principal, staffId);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @HttpCode(200)
  @Post(':id/reset-password')
  @ApiOperation({
    summary: 'Reset a staff password',
    description:
      'Owner only. Sets must_change_password so the staff member must change it after signing in, and clears any login lockout.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ResetStaffPasswordDto })
  @ApiOkResponse({ type: ResetStaffPasswordResponseDto })
  @ApiBadRequestResponse({ description: 'The new password failed validation.' })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  @ApiForbiddenResponse({ description: 'The caller is not the owner or the target is an owner.' })
  @ApiNotFoundResponse({ description: 'No staff member with this id exists in the caller depot.' })
  resetPassword(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id', new ParseUUIDPipe()) staffId: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    return this.users.resetPassword(principal, staffId, dto);
  }
}
