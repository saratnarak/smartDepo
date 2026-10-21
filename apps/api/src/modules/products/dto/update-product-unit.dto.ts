import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

import { DECIMAL_6_MESSAGE, DECIMAL_6_PATTERN } from '../../../common/validation/decimal.js';
import { trimString } from '../../../common/validation/transforms.js';

export class UpdateProductUnitDto {
  @ApiPropertyOptional({ example: 'carton', minLength: 1, maxLength: 40 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 40)
  name?: string;

  @ApiPropertyOptional({
    description: 'How many base units this unit contains. Must be greater than 0 and not 1.',
    example: '24',
    pattern: '^\\d{1,12}(\\.\\d{1,6})?$',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(DECIMAL_6_PATTERN, { message: DECIMAL_6_MESSAGE })
  conversionFactor?: string;
}
