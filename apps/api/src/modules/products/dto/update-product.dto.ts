import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { DECIMAL_3_MESSAGE, DECIMAL_3_PATTERN } from '../../../common/validation/decimal.js';
import { trimString, trimToNull, trimUpperString } from '../../../common/validation/transforms.js';

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Unique per depot. Stored in uppercase.',
    example: 'BEER-001',
    pattern: '^[A-Z0-9][A-Z0-9._-]{0,63}$',
  })
  @IsOptional()
  @Transform(trimUpperString)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,63}$/, {
    message: 'sku must contain only letters, digits, dot, underscore, or dash',
  })
  sku?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 160 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Low-stock threshold in the base unit.',
    example: '120',
    pattern: '^\\d{1,15}(\\.\\d{1,3})?$',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_3_PATTERN, { message: DECIMAL_3_MESSAGE })
  reorderLevel?: string;

  @ApiPropertyOptional({
    description: 'Whether purchases for this product require a batch number and expiry date.',
  })
  @IsOptional()
  @IsBoolean()
  trackBatches?: boolean;
}
