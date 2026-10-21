import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReportRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', description: 'First day of the period.' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Last day of the period.' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ enum: ['json', 'csv'], default: 'json' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 'json' : value))
  @IsIn(['json', 'csv'])
  format: 'json' | 'csv' = 'json';
}

export class SalesReportQueryDto extends ReportRangeQueryDto {
  @ApiPropertyOptional({
    enum: ['day', 'week', 'month', 'custom'],
    default: 'day',
    description: 'How the days are grouped. Custom uses the range as it is.',
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 'day' : value))
  @IsIn(['day', 'week', 'month', 'custom'])
  unit: 'day' | 'week' | 'month' | 'custom' = 'day';
}

export class InventoryReportQueryDto {
  @ApiPropertyOptional({
    example: 30,
    default: 30,
    description: 'How many days ahead count as near expiry.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  expiryDays = 30;

  @ApiPropertyOptional({ enum: ['json', 'csv'], default: 'json' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 'json' : value))
  @IsIn(['json', 'csv'])
  format: 'json' | 'csv' = 'json';
}
