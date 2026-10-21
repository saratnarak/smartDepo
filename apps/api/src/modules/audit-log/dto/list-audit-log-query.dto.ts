import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const AUDIT_FILTER_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

export class ListAuditLogQueryDto {
  @ApiPropertyOptional({
    example: 'STAFF_CREATED',
    description: 'Only the entries with this action, for example STAFF_CREATED.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(AUDIT_FILTER_PATTERN, {
    message: 'action must be an upper case action name',
  })
  action?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only the entries of this user.' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({
    example: 'Product',
    description: 'Only the entries of this kind of record, for example Product.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Only the entries after this moment.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Only the entries before this moment.' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'action', 'entityType'],
    default: 'createdAt',
    description: 'The field used to sort the entries.',
  })
  @IsOptional()
  @IsIn(['createdAt', 'action', 'entityType'])
  sort: 'createdAt' | 'action' | 'entityType' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

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
  @Max(100)
  pageSize = 20;
}
