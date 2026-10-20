import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { Permission } from '../../common/auth/permissions.js';
import { Public } from '../../common/auth/public.decorator.js';
import { RateLimit } from '../../common/auth/rate-limit.decorator.js';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator.js';
import { SWAGGER_SECURITY_SCHEME } from '../../common/bootstrap/configure-swagger.js';
import type { AuthenticatedPrincipal } from '../../common/tenant/tenant-context.js';
import { AuthService } from './auth.service.js';
import {
  LoginResponseDto,
  MeResponseDto,
  RefreshResponseDto,
  RegisterDepotResponseDto,
} from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDepotDto } from './dto/register-depot.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit(5)
  @Post('register')
  @ApiOperation({
    summary: 'Register a depot and its owner',
    description:
      'Creates a PENDING depot and an OWNER account. The registration is reviewed by a Platform Admin before the owner can sign in.',
  })
  @ApiCreatedResponse({ type: RegisterDepotResponseDto })
  @ApiBadRequestResponse({ description: 'The request body failed validation.' })
  @ApiConflictResponse({
    description:
      'The email or phone number is already registered. The response includes details.reason: IDENTIFIER_TAKEN.',
  })
  @ApiTooManyRequestsResponse()
  register(@Body() dto: RegisterDepotDto) {
    return this.auth.register(dto);
  }

  @Public()
  @RateLimit(10)
  @HttpCode(200)
  @Post('login')
  @ApiOperation({
    summary: 'Sign in with an owner email or phone',
    description:
      'Returns a short-lived access token and a refresh token. A correct password for a PENDING, REJECTED, or SUSPENDED depot still returns 401, with details.reason and details.depotStatus.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Invalid credentials, or the depot is not allowed to sign in. For a blocked depot the body includes details.reason: DEPOT_PENDING, DEPOT_REJECTED, DEPOT_SUSPENDED, or ACCOUNT_UNAVAILABLE.',
  })
  @ApiTooManyRequestsResponse()
  login(@Body() dto: LoginDto, @Ip() ipAddress: string) {
    return this.auth.login(dto, ipAddress);
  }

  @Public()
  @RateLimit(20)
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'The refresh token is rotated. Blocked depots receive the same 401 details.reason values as login.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is invalid, expired, or belongs to a blocked depot.',
  })
  @ApiTooManyRequestsResponse()
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto);
  }

  @RequirePermissions(Permission.AUTH_ME)
  @Get('me')
  @ApiBearerAuth(SWAGGER_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Get the current user and depot from the access token' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'The access token is missing, invalid, or expired.' })
  me(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.auth.me(principal);
  }
}
