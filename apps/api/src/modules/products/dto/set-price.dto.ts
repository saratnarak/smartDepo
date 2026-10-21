import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

import { MONEY_2_MESSAGE, MONEY_2_PATTERN } from '../../../common/validation/decimal.js';
import { trimString } from '../../../common/validation/transforms.js';

export class SetPriceDto {
  @ApiProperty({
    description: 'Price amount in the depot currency. Stored as NUMERIC(14,2).',
    example: '1.50',
    pattern: '^\\d{1,12}(\\.\\d{1,2})?$',
  })
  @Transform(trimString)
  @IsString()
  @Matches(MONEY_2_PATTERN, { message: MONEY_2_MESSAGE })
  amount!: string;
}
