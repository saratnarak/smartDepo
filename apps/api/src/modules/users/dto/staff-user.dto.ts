import { ApiProperty } from '@nestjs/swagger';

import { RoleCode } from '../../../generated/prisma/enums.js';
import { STAFF_ROLES } from '../staff-roles.js';

export class StaffUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Sokha Sales' })
  name!: string;

  @ApiProperty({ format: 'email', example: 'sokha.sales@example.com' })
  email!: string;

  @ApiProperty({ nullable: true, example: '012345678' })
  phone!: string | null;

  @ApiProperty({ enum: STAFF_ROLES, example: RoleCode.SALES })
  role!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'True when an owner reset the password.', example: false })
  mustChangePassword!: boolean;

  @ApiProperty({ format: 'date-time', nullable: true, example: null })
  lastLoginAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class StaffListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 3 })
  total!: number;
}

export class PaginatedStaffDto {
  @ApiProperty({ type: [StaffUserDto] })
  data!: StaffUserDto[];

  @ApiProperty({ type: () => StaffListMetaDto })
  meta!: StaffListMetaDto;
}

export class ResetStaffPasswordResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: true })
  mustChangePassword!: boolean;
}
