import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

import { DECIMAL_3_MESSAGE, DECIMAL_3_PATTERN } from '../../../common/validation/decimal.js';
import { trimString, trimToNull } from '../../../common/validation/transforms.js';

export class DamageStockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ format: 'uuid', description: 'Unit used for the entered quantity.' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({
    description: 'Positive quantity in the selected unit. It is recorded as a negative movement.',
    example: '2',
    pattern: '^\\d{1,15}(\\.\\d{1,3})?$',
  })
  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_3_PATTERN, { message: DECIMAL_3_MESSAGE })
  quantity!: string;

  @ApiProperty({ example: 'Broken bottles in transit', minLength: 3, maxLength: 500 })
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
