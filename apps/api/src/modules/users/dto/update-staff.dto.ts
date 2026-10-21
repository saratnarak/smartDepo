import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { trimLowerString, trimString, trimToNull } from '../../../common/validation/transforms.js';
import { STAFF_ROLES } from '../staff-roles.js';
import type { StaffRole } from '../staff-roles.js';

export class UpdateStaffDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ format: 'email', maxLength: 254 })
  @IsOptional()
  @Transform(trimLowerString)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    description: 'Set to null or an empty string to clear the phone number.',
    maxLength: 20,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(/^\+?[0-9() -]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;

  @ApiPropertyOptional({
    description: 'Set false to deactivate; true reactivates the account within the plan limit.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
