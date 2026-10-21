import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_PATTERN_MESSAGE,
} from '../../../common/validation/password.js';
import { trimLowerString, trimString, trimToNull } from '../../../common/validation/transforms.js';
import { STAFF_ROLES } from '../staff-roles.js';
import type { StaffRole } from '../staff-roles.js';

export class CreateStaffDto {
  @ApiProperty({ example: 'Sokha Sales', minLength: 2, maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ format: 'email', example: 'sokha.sales@example.com', maxLength: 254 })
  @Transform(trimLowerString)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({
    description:
      'Optional unique phone number. Digits, spaces, parentheses, +, and - are accepted.',
    example: '012345678',
    maxLength: 20,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(/^\+?[0-9() -]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @ApiProperty({ enum: STAFF_ROLES, example: 'SALES' })
  @IsIn(STAFF_ROLES)
  role!: StaffRole;

  @ApiProperty({
    description: 'Initial password. The staff member can change it after signing in.',
    example: 'Password1',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  password!: string;
}
