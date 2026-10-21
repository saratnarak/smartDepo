import { ApiProperty } from '@nestjs/swagger';

import { DepotStatus, RoleCode } from '../../../generated/prisma/enums.js';

export class SafeUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sokha Owner' })
  name!: string;

  @ApiProperty({ format: 'email', example: 'owner@example.com' })
  email!: string;

  @ApiProperty({ nullable: true, example: '012345678' })
  phone!: string | null;

  @ApiProperty({ enum: RoleCode, example: RoleCode.OWNER })
  role!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  depotId!: string | null;

  @ApiProperty({
    description:
      'True when an owner reset this password; the client should ask the user to change it.',
    example: false,
  })
  mustChangePassword!: boolean;
}

export class SafeDepotDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Boeng Keng Kong Depot' })
  name!: string;

  @ApiProperty({ enum: DepotStatus, example: DepotStatus.PENDING })
  status!: string;
}

export class AuthTokensDto {
  @ApiProperty({
    description: 'Short-lived JWT access token. Send it as a Bearer token.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token. The web app keeps this in an httpOnly cookie through its BFF.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: '15m' })
  expiresIn!: string;
}

export class LoginResponseDto extends AuthTokensDto {
  @ApiProperty({ type: () => SafeUserDto })
  user!: SafeUserDto;

  @ApiProperty({ type: () => SafeDepotDto, nullable: true })
  depot!: SafeDepotDto | null;
}

export class RefreshResponseDto extends AuthTokensDto {}

export class MeResponseDto {
  @ApiProperty({ type: () => SafeUserDto })
  user!: SafeUserDto;

  @ApiProperty({ type: () => SafeDepotDto, nullable: true })
  depot!: SafeDepotDto | null;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: false })
  mustChangePassword!: boolean;
}

export class RegisteredOwnerDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sokha Owner' })
  name!: string;

  @ApiProperty({ format: 'email', example: 'owner@example.com' })
  email!: string;

  @ApiProperty({ example: '012345678' })
  phone!: string;
}

export class RegisterDepotResponseDto {
  @ApiProperty({ type: () => SafeDepotDto })
  depot!: SafeDepotDto;

  @ApiProperty({ type: () => RegisteredOwnerDto })
  owner!: RegisteredOwnerDto;
}
