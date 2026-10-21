import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { STAFF_ROLES } from '../staff-roles.js';
import type { StaffRole } from '../staff-roles.js';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
};

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: STAFF_ROLES, description: 'Filter by staff role.' })
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;

  @ApiPropertyOptional({ description: 'Filter by active or deactivated accounts.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Case-insensitive search on staff name, email, or phone.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize = 20;

  @ApiPropertyOptional({
    enum: ['createdAt', 'name', 'isActive', 'lastLoginAt'],
    default: 'createdAt',
    description: 'Field used to sort the staff list.',
  })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'isActive', 'lastLoginAt'])
  sort: 'createdAt' | 'name' | 'isActive' | 'lastLoginAt' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
