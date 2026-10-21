import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

import {
  SIGNED_DECIMAL_3_MESSAGE,
  SIGNED_DECIMAL_3_PATTERN,
} from '../../../common/validation/decimal.js';
import { trimString, trimToNull } from '../../../common/validation/transforms.js';

export class AdjustStockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid', description: 'Unit used for the entered quantity.' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({
    description: 'Signed quantity in the selected unit. Positive adds stock, negative removes it.',
    example: '-2',
    pattern: '^-?\\d{1,15}(\\.\\d{1,3})?$',
  })
  @Transform(trimString)
  @IsString()
  @Matches(SIGNED_DECIMAL_3_PATTERN, { message: SIGNED_DECIMAL_3_MESSAGE })
  quantity!: string;

  @ApiProperty({ example: 'Physical count correction', minLength: 3, maxLength: 500 })
  @Transform(trimString)
  @IsString()
  @Length(3, 500)
  reason!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsUUID()
  batchId?: string | null;
}
