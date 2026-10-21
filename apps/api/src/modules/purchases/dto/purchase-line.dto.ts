import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

import {
  DECIMAL_3_MESSAGE,
  DECIMAL_3_PATTERN,
  MONEY_2_MESSAGE,
  MONEY_2_PATTERN,
} from '../../../common/validation/decimal.js';
import { trimString, trimToNull } from '../../../common/validation/transforms.js';

export class PurchaseLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid', description: 'Unit used for the entered quantity and cost.' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ example: '12', pattern: '^\\d{1,15}(\\.\\d{1,3})?$' })
  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_3_PATTERN, { message: DECIMAL_3_MESSAGE })
  quantity!: string;

  @ApiProperty({
    description: 'Cost for one entered unit, not one base unit.',
    example: '24.00',
    pattern: '^\\d{1,12}(\\.\\d{1,2})?$',
  })
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_2_PATTERN, { message: MONEY_2_MESSAGE })
  unitCost!: string;

  @ApiPropertyOptional({
    description: 'Required when the product tracks batches.',
    example: 'LOT-2026-01',
    maxLength: 80,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Length(1, 80)
  batchNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Required when the product tracks batches.',
    example: '2027-01-31',
    format: 'date',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsDateString()
  expiryDate?: string | null;
}
